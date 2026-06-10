import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';
import ExcelJS from 'exceljs';
import { computeReviewTasks, REVIEW_RULES } from '../domain/review.js';
import { getSettings } from './settings.js';
import { buildEstimateWorkbook } from '../excel.js';
import { toDateKey } from '../domain/schedule.js';
import { naturalWbsCompare } from '../domain/estimate.js';
import { scheduleProject } from '../scheduleStore.js';
import { expandWbs } from '../domain/wbs.js';
import { runClaude } from '../claude-cli.js';
import { buildEstimatePrompt, parseEstimateResponse } from '../domain/aiEstimate.js';
import { searchReferences } from '../ftsStore.js';
import {
  splitNaturalText,
  extractRequirements,
  parseEstimateRows,
  parseCsv,
} from '../domain/import.js';

// プロジェクト(案件)。要件・タスクの入れ物 (US-001 の前提)。
export const projects = new Hono();

const projectInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(['new', 'existing']).optional(),
  referenceProjectId: z.string().min(1).optional(),
});

projects.get('/', async (c) => {
  const list = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
  // 各プロジェクトがガント(計画済みタスク)を持つか (US-032)
  const grp = await prisma.task.groupBy({
    by: ['projectId'],
    where: { plannedStart: { not: null } },
    _count: { _all: true },
  });
  const scheduled = new Set(grp.map((g) => g.projectId));
  return c.json(list.map((p) => ({ ...p, hasSchedule: scheduled.has(p.id) })));
});

projects.post('/', zValidator('json', projectInput), async (c) => {
  const data = c.req.valid('json');
  const created = await prisma.project.create({ data });
  return c.json(created, 201);
});

projects.get('/:id', async (c) => {
  const id = c.req.param('id');
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return c.json({ error: 'Not Found' }, 404);
  return c.json(project);
});

// プロジェクト削除 (US-030)。配下の要件/タスク/日報は schema の Cascade で連動削除。
projects.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await prisma.project.delete({ where: { id } });
  return c.body(null, 204);
});

// 見積 Excel(.xlsx) エクスポート (US-016)。見積諸元+根拠 / WBS / ガント の 3 シート。
projects.get('/:id/estimate.xlsx', async (c) => {
  const projectId = c.req.param('id');
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return c.json({ error: 'Not Found' }, 404);

  const [taskRows, holidayRows] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, include: { assignee: true } }),
    prisma.holiday.findMany(),
  ]);

  const wb = buildEstimateWorkbook({
    projectName: project.name,
    startDate: taskRows.find((t) => t.plannedStart)?.plannedStart?.toISOString().slice(0, 10) ?? null,
    holidays: new Set(holidayRows.map((h) => toDateKey(h.date))),
    tasks: taskRows.map((t) => ({
      wbsId: t.wbsId,
      name: t.name,
      level: t.level,
      phase: t.phase,
      estimateDays: t.estimateDays,
      utilizationRate: t.utilizationRate,
      kind: t.kind,
      assigneeName: t.assignee?.name ?? null,
      estimateNote: t.estimateNote,
      plannedStart: t.plannedStart,
      plannedEnd: t.plannedEnd,
      progress: t.progress,
    })),
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `estimate_${projectId}.xlsx`;
  return new Response(buffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
});

// ---- 柔軟な取込 (US-019) ----

async function fileToRows(file: File): Promise<string[][]> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseCsv(buf.toString('utf-8'));
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  ws?.eachRow((row) => {
    const arr: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => arr.push(String(cell.text ?? '').trim()));
    rows.push(arr);
  });
  return rows;
}

// 要件群を作成し、必要なら標準工程(WBS)へ展開する
async function createRequirements(projectId: string, contents: string[], expand: boolean) {
  if (contents.length === 0) return { requirements: 0, tasks: 0 };
  let featureNo = await prisma.task.count({ where: { projectId, level: 1 } });
  let tasks = 0;
  for (const content of contents) {
    const req = await prisma.requirement.create({
      data: { projectId, content, source: 'import' },
    });
    if (!expand) continue;
    featureNo += 1;
    const nodes = expandWbs(featureNo, content, []);
    const idMap = new Map<string, string>();
    for (const n of nodes) {
      const t = await prisma.task.create({
        data: {
          projectId,
          requirementId: req.id,
          name: n.name,
          level: n.level,
          wbsId: n.wbsId,
          phase: n.phase ?? undefined,
          parentId: n.parentTempId ? idMap.get(n.parentTempId) : undefined,
          kind: 'task',
        },
      });
      idMap.set(n.tempId, t.id);
      tasks += 1;
    }
  }
  return { requirements: contents.length, tasks };
}

// 自然文テキストから要件取込
const importTextInput = z.object({ text: z.string().min(1), expand: z.boolean().optional() });
projects.post('/:id/import/requirements-text', zValidator('json', importTextInput), async (c) => {
  const projectId = c.req.param('id');
  // US-038: 取込時に WBS は展開しない(展開は見積・ガント生成ステップで行う)。明示 true 時のみ展開。
  const { text, expand = false } = c.req.valid('json');
  const result = await createRequirements(projectId, splitNaturalText(text), expand);
  return c.json(result, 201);
});

// ファイル(xlsx/csv)から要件取込
projects.post('/:id/import/requirements-file', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'file is required' }, 400);
  // US-038: 既定では WBS 展開しない(明示 'true' のときのみ)
  const expand = body['expand'] === 'true';
  const rows = await fileToRows(file);
  const result = await createRequirements(projectId, extractRequirements(rows), expand);
  return c.json(result, 201);
});

// ファイル(xlsx/csv)から見積明細取込(タスクを直接生成)
projects.post('/:id/import/estimate-file', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'file is required' }, 400);
  const rows = await fileToRows(file);
  const specs = parseEstimateRows(rows);
  const members = await prisma.member.findMany();
  const byName = new Map(members.map((m) => [m.name, m.id]));
  let created = 0;
  for (const s of specs) {
    await prisma.task.create({
      data: {
        projectId,
        name: s.name,
        level: 3,
        wbsId: s.wbsId,
        phase: s.phase,
        estimateDays: s.estimateDays ?? 0,
        utilizationRate: s.utilizationRate ?? 1,
        estimateNote: s.estimateNote,
        assigneeId: s.assigneeName ? byName.get(s.assigneeName) : undefined,
        kind: 'task',
      },
    });
    created += 1;
  }
  return c.json({ tasks: created }, 201);
});

// レビュー自動展開 (US-014 / US-040 / US-044)。
// 対象(level2)ごと(無ければ機能 level1 ごと)に、開発工程の後へレビュー工程を挿入する。
// レビュワー=最上位(PM)→リーダーへ自動割付。レビュイー(開発担当)側にもレビュー工程を計上する。
// 冪等: 既存の kind='review' を削除してから再生成する。
export async function expandReviewsForProject(
  projectId: string,
  format: 'sync' | 'doc' = 'sync',
): Promise<number> {
  const [allTasks, members, cfg] = await Promise.all([
    prisma.task.findMany({ where: { projectId } }),
    prisma.member.findMany({ orderBy: { createdAt: 'asc' } }),
    getSettings(),
  ]);
  const reviewer =
    members.find((m) => m.role === 'pm') ??
    members.find((m) => m.role === 'leader') ??
    members.find((m) => m.role === 'PL') ?? // 旧データ互換
    null;

  await prisma.task.deleteMany({ where: { projectId, kind: 'review' } });

  const rules = REVIEW_RULES.map((r) => ({ ...r, ratio: cfg.reviewRatio, min: cfg.reviewMinDays }));

  // グループ = 対象(level2)。無ければ機能(level1)。
  const targets = allTasks.filter((t) => t.level === 2);
  const groups = targets.length > 0 ? targets : allTasks.filter((t) => t.level === 1);

  let created = 0;
  for (const group of groups) {
    const groupNo = group.wbsId ?? String(group.id);
    const devTasks = allTasks.filter(
      (t) => t.kind === 'task' && t.wbsId && t.wbsId.startsWith(`${groupNo}.`),
    );
    if (devTasks.length === 0) continue;
    const specs = computeReviewTasks(
      groupNo,
      devTasks.map((t) => ({ phase: t.phase, estimateDays: t.estimateDays })),
      rules,
    );
    for (const s of specs) {
      // レビュイー = 対象内で当該工程の開発担当(代表として最初の担当)
      const rule = rules.find((r) => s.phase.includes(r.trigger));
      const revieweeId =
        rule != null
          ? devTasks.find(
              (t) => t.phase && t.phase.includes(rule.trigger) && !t.phase.includes('レビュー') && t.assigneeId,
            )?.assigneeId ?? null
          : null;

      // 対面(sync): レビュワー・レビュイー双方を同一区間に同期配置(reviewLinkId で紐付け)。
      // 書面(doc): レビュワーのみ(レビュイーは拘束せず、その間別タスクを進められる)。
      const canPair = format === 'sync' && revieweeId && revieweeId !== reviewer?.id;
      const linkId = canPair ? `${group.id}:${s.wbsId}` : null;
      const reviewerSuffix = format === 'doc' ? '(書面レビュー)' : '(レビュー)';

      // レビュワー側(PM 等)
      await prisma.task.create({
        data: {
          projectId,
          requirementId: group.requirementId,
          parentId: group.id,
          name: `${s.name}${reviewerSuffix}`,
          level: 3,
          wbsId: s.wbsId,
          phase: s.phase,
          estimateDays: s.estimateDays,
          estimateNote: s.estimateNote,
          kind: 'review',
          reviewFormat: format,
          reviewLinkId: linkId,
          assigneeId: reviewer?.id,
        },
      });
      created += 1;

      // レビュイー側(開発担当)。対面のときだけ同期ペアとして計上。
      if (canPair) {
        await prisma.task.create({
          data: {
            projectId,
            requirementId: group.requirementId,
            parentId: group.id,
            name: `${s.name}(レビュー対応)`,
            level: 3,
            wbsId: `${s.wbsId}b`,
            phase: s.phase,
            estimateDays: s.estimateDays,
            estimateNote: `${s.estimateNote} / レビュイー対応`,
            kind: 'review',
            reviewFormat: format,
            reviewLinkId: linkId,
            assigneeId: revieweeId,
          },
        });
        created += 1;
      }
    }
  }
  return created;
}

// 互換: レビュー自動展開(include=true 相当, 対面)
projects.post('/:id/expand-reviews', async (c) => {
  const created = await expandReviewsForProject(c.req.param('id'));
  return c.json({ created }, 201);
});

// レビュー工程の有無・形態を切り替える (US-044 / US-047)。
// include=true で展開(format: sync=対面 / doc=書面)、false で全削除。
const reviewsInput = z.object({
  include: z.boolean(),
  format: z.enum(['sync', 'doc']).optional(),
});
projects.post('/:id/reviews', zValidator('json', reviewsInput), async (c) => {
  const projectId = c.req.param('id');
  const { include, format } = c.req.valid('json');
  if (include) {
    const created = await expandReviewsForProject(projectId, format ?? 'sync');
    return c.json({ include: true, format: format ?? 'sync', created });
  }
  const { count } = await prisma.task.deleteMany({ where: { projectId, kind: 'review' } });
  return c.json({ include: false, removed: count });
});

// AI 見積生成 (US-036)。Claude Code CLI(サブスク枠)で要件→タスク・工数・根拠を生成し WBS 化。
// AI 見積の中核処理。要件(既存改修は参照資料も)から Claude Code で見積を生成し WBS タスク化する。
// /ai-estimate と /ai-plan(要件→ガント一気通貫)で共有する。
type AiEstimateResult =
  | { ok: true; features: number; tasks: number }
  | { ok: false; status: 400 | 404 | 502; error: string };

async function runAiEstimate(projectId: string): Promise<AiEstimateResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, status: 404, error: 'Not Found' };

  const requirements = await prisma.requirement.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });
  if (requirements.length === 0) {
    return { ok: false, status: 400, error: '要件がありません。先に要件を登録/取り込みしてください。' };
  }

  const cfg = await getSettings();
  // 参照資料が紐づく案件(既存改修・マイグレーション等)は既存モードで見積 (US-060)
  const isExisting = !!project.referenceProjectId;

  const reqCtx = [];
  for (const r of requirements) {
    let references: { path: string; snippet: string }[] | undefined;
    if (isExisting && project.referenceProjectId) {
      const hits = await searchReferences(project.referenceProjectId, r.content, 3);
      references = hits.map((h) => ({ path: h.path, snippet: h.excerpt ?? '' }));
    }
    reqCtx.push({ content: r.content, references });
  }

  const prompt = buildEstimatePrompt({
    projectName: project.name,
    kind: isExisting ? 'existing' : 'new',
    requirements: reqCtx,
    hoursPerDay: cfg.hoursPerDay,
  });

  let stdout: string;
  try {
    stdout = await runClaude(prompt);
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : 'AI 処理に失敗しました。' };
  }

  let parsed;
  try {
    parsed = parseEstimateResponse(stdout);
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : 'AI 出力の解析に失敗しました。' };
  }

  // 生成結果を 3 階層 WBS 化(機能=level1, 対象=level2, 作業=level3)
  let featureNo = await prisma.task.count({ where: { projectId, level: 1 } });
  let createdTasks = 0;
  for (const f of parsed.features) {
    featureNo += 1;
    const feature = await prisma.task.create({
      data: { projectId, name: f.name, level: 1, wbsId: String(featureNo), kind: 'task' },
    });
    let targetNo = 0;
    for (const tg of f.targets) {
      targetNo += 1;
      const targetWbs = `${featureNo}.${targetNo}`;
      const target = await prisma.task.create({
        data: {
          projectId,
          parentId: feature.id,
          name: tg.name,
          level: 2,
          wbsId: targetWbs,
          kind: 'task',
        },
      });
      let taskNo = 0;
      for (const t of tg.tasks) {
        taskNo += 1;
        await prisma.task.create({
          data: {
            projectId,
            parentId: target.id,
            name: t.name,
            level: 3,
            wbsId: `${targetWbs}.${taskNo}`,
            phase: t.phase,
            estimateDays: t.estimateDays,
            estimateNote: t.reason || undefined,
            kind: 'task',
          },
        });
        createdTasks += 1;
      }
    }
  }

  return { ok: true, features: parsed.features.length, tasks: createdTasks };
}

projects.post('/:id/ai-estimate', async (c) => {
  const result = await runAiEstimate(c.req.param('id'));
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ features: result.features, tasks: result.tasks });
});

// 要件 → AI見積 → スケジュール割付 を 1 アクションで実行しガントを生成する (US-037)。
// ce2 の「要件 → スケジュール表」に相当(出力はガント)。AI は Claude Code 契約枠で実行(API 課金なし)。
const aiPlanInput = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate は YYYY-MM-DD 形式'),
});

projects.post('/:id/ai-plan', zValidator('json', aiPlanInput), async (c) => {
  const projectId = c.req.param('id');
  const { startDate } = c.req.valid('json');
  const est = await runAiEstimate(projectId);
  if (!est.ok) return c.json({ error: est.error }, est.status);
  const { scheduled } = await scheduleProject(projectId, startDate);
  return c.json({ features: est.features, tasks: est.tasks, scheduled });
});

// 標準テンプレートを適用してWBSを作成する (US-060)。
projects.post('/:id/apply-template', zValidator('json', z.object({ templateId: z.string().min(1) })), async (c) => {
  const projectId = c.req.param('id');
  const tmpl = await prisma.estimateTemplate.findUnique({ where: { id: c.req.valid('json').templateId } });
  if (!tmpl) return c.json({ error: 'テンプレートが見つかりません。' }, 404);
  const items = (tmpl.items as unknown as {
    wbsId: string;
    level: number;
    name: string;
    phase?: string;
    estimateDays?: number;
    utilizationRate?: number;
    note?: string;
  }[]).slice();
  // wbsId 昇順(浅い→深い)で作成し、親を wbsId の接頭辞で解決
  items.sort((a, b) => a.wbsId.split('.').length - b.wbsId.split('.').length || naturalWbsCompare(a.wbsId, b.wbsId));
  const idByWbs = new Map<string, string>();
  let created = 0;
  for (const it of items) {
    const parts = it.wbsId.split('.');
    const parentWbs = parts.length > 1 ? parts.slice(0, -1).join('.') : null;
    const t = await prisma.task.create({
      data: {
        projectId,
        name: it.name,
        level: it.level,
        wbsId: it.wbsId,
        parentId: parentWbs ? idByWbs.get(parentWbs) : undefined,
        phase: it.phase,
        estimateDays: it.estimateDays ?? 0,
        utilizationRate: it.utilizationRate ?? 1,
        estimateNote: it.note,
        kind: 'task',
      },
    });
    idByWbs.set(it.wbsId, t.id);
    created += 1;
  }
  return c.json({ created }, 201);
});

// 効率化調整 (US-014)。複数機能同時実施の重複削減を負の工数 1 行で表現する。
const efficiencyInput = z.object({
  estimateDays: z.number(),
  note: z.string().optional(),
});

projects.post('/:id/efficiency', zValidator('json', efficiencyInput), async (c) => {
  const projectId = c.req.param('id');
  const { estimateDays, note } = c.req.valid('json');
  const task = await prisma.task.create({
    data: {
      projectId,
      name: '効率化調整',
      level: 1,
      estimateDays,
      kind: 'efficiency',
      estimateNote: note ?? '複数機能同時実施による共通作業削減',
    },
  });
  return c.json(task, 201);
});
