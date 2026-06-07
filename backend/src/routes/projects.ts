import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';
import ExcelJS from 'exceljs';
import { computeReviewTasks, REVIEW_RULES } from '../domain/review.js';
import { getSettings } from './settings.js';
import { buildEstimateWorkbook } from '../excel.js';
import { toDateKey } from '../domain/schedule.js';
import { expandWbs } from '../domain/wbs.js';
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
  return c.json(list);
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
  const { text, expand = true } = c.req.valid('json');
  const result = await createRequirements(projectId, splitNaturalText(text), expand);
  return c.json(result, 201);
});

// ファイル(xlsx/csv)から要件取込
projects.post('/:id/import/requirements-file', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!(file instanceof File)) return c.json({ error: 'file is required' }, 400);
  const expand = body['expand'] !== 'false';
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

// レビュー自動展開 (US-014)。開発工程の後に PL レビューを機能ごとに自動挿入する。
// 冪等: 既存の kind='review' を削除してから再生成する。
projects.post('/:id/expand-reviews', async (c) => {
  const projectId = c.req.param('id');
  const [features, reviewer, cfg] = await Promise.all([
    prisma.task.findMany({ where: { projectId, level: 1 } }),
    prisma.member.findFirst({ where: { role: 'PL' }, orderBy: { createdAt: 'asc' } }),
    getSettings(),
  ]);
  await prisma.task.deleteMany({ where: { projectId, kind: 'review' } });

  // 設定のレビュー率/下限を各ルールに適用 (US-027)
  const rules = REVIEW_RULES.map((r) => ({ ...r, ratio: cfg.reviewRatio, min: cfg.reviewMinDays }));

  const created = [];
  for (const feature of features) {
    const featNo = feature.wbsId ?? String(feature.id);
    const devTasks = await prisma.task.findMany({
      where: { projectId, kind: 'task', wbsId: { startsWith: `${featNo}.` } },
    });
    const specs = computeReviewTasks(
      featNo,
      devTasks.map((t) => ({ phase: t.phase, estimateDays: t.estimateDays })),
      rules,
    );
    for (const s of specs) {
      const task = await prisma.task.create({
        data: {
          projectId,
          requirementId: feature.requirementId,
          parentId: feature.id,
          name: s.name,
          level: 3,
          wbsId: s.wbsId,
          phase: s.phase,
          estimateDays: s.estimateDays,
          estimateNote: s.estimateNote,
          kind: 'review',
          assigneeId: reviewer?.id,
        },
      });
      created.push(task);
    }
  }
  return c.json(created, 201);
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
