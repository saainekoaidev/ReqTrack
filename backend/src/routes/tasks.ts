import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';
import { detectDelay, delayedMembers, type PlannedTask } from '../domain/schedule.js';

// タスク/工程 + 進捗報告 + 遅延検出 (US-002/003/004/007/008/009/010)
export const tasks = new Hono();

const taskInput = z.object({
  projectId: z.string().min(1),
  requirementId: z.string().min(1).optional(),
  name: z.string().min(1),
  estimateDays: z.number().nonnegative().optional(),
  plannedStart: z.string().datetime().optional(),
  plannedEnd: z.string().datetime().optional(),
  assigneeId: z.string().min(1).optional(),
});

const reportInput = z.object({
  memberId: z.string().min(1),
  progress: z.number().int().min(0).max(100),
  comment: z.string().optional(),
});

// GET /api/tasks?projectId=xxx (任意。指定時はそのプロジェクトに絞り込む)
const listQuery = z.object({ projectId: z.string().min(1).optional() });

tasks.get('/', zValidator('query', listQuery), async (c) => {
  const { projectId } = c.req.valid('query');
  const list = await prisma.task.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ plannedStart: 'asc' }, { createdAt: 'asc' }],
    include: { assignee: true, requirement: true },
  });
  return c.json(list);
});

tasks.post('/', zValidator('json', taskInput), async (c) => {
  const v = c.req.valid('json');
  const created = await prisma.task.create({
    data: {
      projectId: v.projectId,
      requirementId: v.requirementId,
      name: v.name,
      estimateDays: v.estimateDays ?? 0,
      plannedStart: v.plannedStart ? new Date(v.plannedStart) : undefined,
      plannedEnd: v.plannedEnd ? new Date(v.plannedEnd) : undefined,
      assigneeId: v.assigneeId,
    },
  });
  return c.json(created, 201);
});

// タスクの部分更新 (US-003 見積 / US-004 計画日 / 担当割当)
const taskPatch = z.object({
  name: z.string().min(1).optional(),
  estimateDays: z.number().nonnegative().optional(),
  plannedStart: z.string().datetime().nullable().optional(),
  plannedEnd: z.string().datetime().nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

tasks.patch('/:id', zValidator('json', taskPatch), async (c) => {
  const id = c.req.param('id');
  const v = c.req.valid('json');
  const updated = await prisma.task.update({
    where: { id },
    data: {
      name: v.name,
      estimateDays: v.estimateDays,
      plannedStart:
        v.plannedStart === undefined ? undefined : v.plannedStart ? new Date(v.plannedStart) : null,
      plannedEnd:
        v.plannedEnd === undefined ? undefined : v.plannedEnd ? new Date(v.plannedEnd) : null,
      assigneeId: v.assigneeId,
      progress: v.progress,
    },
    include: { assignee: true, requirement: true },
  });
  return c.json(updated);
});

// 進捗報告を登録し、タスクの進捗率へ反映する (US-007 → US-008)
tasks.post('/:id/reports', zValidator('json', reportInput), async (c) => {
  const taskId = c.req.param('id');
  const { memberId, progress, comment } = c.req.valid('json');
  const [report] = await prisma.$transaction([
    prisma.progressReport.create({ data: { taskId, memberId, progress, comment } }),
    prisma.task.update({ where: { id: taskId }, data: { progress } }),
  ]);
  return c.json(report, 201);
});

// 遅延しているタスクを検出する (US-009)
tasks.get('/delays', async (c) => {
  const now = new Date();
  const all = await prisma.task.findMany();
  const results = all
    .map((t) => detectDelay(toPlanned(t), now))
    .filter((r) => r.isDelayed);
  return c.json(results);
});

// 遅れている要員を洗い出す (US-010)
tasks.get('/delays/members', async (c) => {
  const now = new Date();
  const all = await prisma.task.findMany();
  return c.json(delayedMembers(all.map(toPlanned), now));
});

function toPlanned(t: {
  id: string;
  name: string;
  assigneeId: string | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  progress: number;
}): PlannedTask {
  return {
    id: t.id,
    name: t.name,
    assigneeId: t.assigneeId,
    plannedStart: t.plannedStart,
    plannedEnd: t.plannedEnd,
    progress: t.progress,
  };
}
