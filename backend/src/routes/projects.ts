import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';
import { computeReviewTasks } from '../domain/review.js';
import { buildEstimateWorkbook } from '../excel.js';
import { toDateKey } from '../domain/schedule.js';

// プロジェクト(案件)。要件・タスクの入れ物 (US-001 の前提)。
export const projects = new Hono();

const projectInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
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

// レビュー自動展開 (US-014)。開発工程の後に PL レビューを機能ごとに自動挿入する。
// 冪等: 既存の kind='review' を削除してから再生成する。
projects.post('/:id/expand-reviews', async (c) => {
  const projectId = c.req.param('id');
  const [features, reviewer] = await Promise.all([
    prisma.task.findMany({ where: { projectId, level: 1 } }),
    prisma.member.findFirst({ where: { role: 'PL' }, orderBy: { createdAt: 'asc' } }),
  ]);
  await prisma.task.deleteMany({ where: { projectId, kind: 'review' } });

  const created = [];
  for (const feature of features) {
    const featNo = feature.wbsId ?? String(feature.id);
    const devTasks = await prisma.task.findMany({
      where: { projectId, kind: 'task', wbsId: { startsWith: `${featNo}.` } },
    });
    const specs = computeReviewTasks(
      featNo,
      devTasks.map((t) => ({ phase: t.phase, estimateDays: t.estimateDays })),
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
