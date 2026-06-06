import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  detectDelay,
  delayedMembers,
  scheduleTasks,
  toDateKey,
  buildRecoveryPlan,
  type PlannedTask,
} from '../domain/schedule.js';

// タスク/工程 + 進捗報告 + 遅延検出 (US-002/003/004/007/008/009/010)
export const tasks = new Hono();

const taskInput = z.object({
  projectId: z.string().min(1),
  requirementId: z.string().min(1).optional(),
  name: z.string().min(1),
  estimateDays: z.number().nonnegative().optional(),
  utilizationRate: z.number().gt(0).max(1).optional(),
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
      utilizationRate: v.utilizationRate ?? 1,
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
  utilizationRate: z.number().gt(0).max(1).optional(),
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
      utilizationRate: v.utilizationRate,
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

// ガント初版を生成する (US-004)。見積から稼働日ベースで計画日を割り付ける。
const scheduleInput = z.object({
  projectId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate は YYYY-MM-DD 形式'),
});

tasks.post('/schedule', zValidator('json', scheduleInput), async (c) => {
  const { projectId, startDate } = c.req.valid('json');
  const [projectTasks, holidayRows] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
    prisma.holiday.findMany(),
  ]);
  const holidays = new Set(holidayRows.map((h) => toDateKey(h.date)));
  const scheduled = scheduleTasks(
    projectTasks.map((t) => ({
      id: t.id,
      estimateDays: t.estimateDays,
      utilizationRate: t.utilizationRate,
    })),
    new Date(`${startDate}T00:00:00.000Z`),
    holidays,
  );
  await prisma.$transaction(
    scheduled.map((s) =>
      prisma.task.update({
        where: { id: s.id },
        data: { plannedStart: s.plannedStart, plannedEnd: s.plannedEnd },
      }),
    ),
  );
  const updated = await prisma.task.findMany({
    where: { projectId },
    orderBy: [{ plannedStart: 'asc' }, { createdAt: 'asc' }],
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

// 遅延しているタスクを検出する (US-009)。?projectId= で絞り込み可能。
tasks.get('/delays', zValidator('query', listQuery), async (c) => {
  const { projectId } = c.req.valid('query');
  const now = new Date();
  const all = await prisma.task.findMany({
    where: projectId ? { projectId } : undefined,
    include: { assignee: true },
  });
  const byId = new Map(all.map((t) => [t.id, t]));
  const results = all
    .map((t) => detectDelay(toPlanned(t), now))
    .filter((r) => r.isDelayed)
    .sort((a, b) => b.behindBy - a.behindBy)
    .map((r) => {
      const t = byId.get(r.taskId);
      return { ...r, name: t?.name ?? '', assigneeName: t?.assignee?.name ?? null };
    });
  return c.json(results);
});

// 遅れている要員を洗い出す (US-010)。?projectId= で絞り込み可能。
tasks.get('/delays/members', zValidator('query', listQuery), async (c) => {
  const { projectId } = c.req.valid('query');
  const now = new Date();
  const [all, members] = await Promise.all([
    prisma.task.findMany({ where: projectId ? { projectId } : undefined }),
    prisma.member.findMany(),
  ]);
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const result = delayedMembers(all.map(toPlanned), now).map((m) => ({
    ...m,
    name: memberName.get(m.assigneeId) ?? '(不明)',
  }));
  return c.json(result);
});

// リカバリプラン案を生成・提示する (US-011)。?projectId= で絞り込み可能。
tasks.get('/recovery', zValidator('query', listQuery), async (c) => {
  const { projectId } = c.req.valid('query');
  const now = new Date();
  const all = await prisma.task.findMany({
    where: projectId ? { projectId } : undefined,
    include: { assignee: true },
  });
  const plan = buildRecoveryPlan(
    all.map((t) => ({
      id: t.id,
      name: t.name,
      estimateDays: t.estimateDays,
      assigneeName: t.assignee?.name ?? null,
      plannedStart: t.plannedStart,
      plannedEnd: t.plannedEnd,
      progress: t.progress,
    })),
    now,
  );
  return c.json(plan);
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
