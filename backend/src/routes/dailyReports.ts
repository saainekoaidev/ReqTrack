import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';

// 日報 (US-017)。複数タスクの進捗をまとめて登録し、タスク進捗率へ反映する。
export const dailyReports = new Hono();

const listQuery = z.object({ projectId: z.string().min(1) });

// 一覧: 日報ヘッダ + 報告者 + 明細件数
dailyReports.get('/', zValidator('query', listQuery), async (c) => {
  const { projectId } = c.req.valid('query');
  const list = await prisma.dailyReport.findMany({
    where: { projectId },
    orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
    include: { member: true, _count: { select: { entries: true } } },
  });
  return c.json(list);
});

// 詳細: 明細(タスク名付き)
dailyReports.get('/:id', async (c) => {
  const id = c.req.param('id');
  const report = await prisma.dailyReport.findUnique({
    where: { id },
    include: { member: true, entries: { include: { task: true } } },
  });
  if (!report) return c.json({ error: 'Not Found' }, 404);
  return c.json(report);
});

const createInput = z.object({
  projectId: z.string().min(1),
  memberId: z.string().min(1),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'reportDate は YYYY-MM-DD 形式'),
  note: z.string().optional(),
  entries: z
    .array(
      z.object({
        taskId: z.string().min(1),
        progress: z.number().min(0).max(100),
        comment: z.string().optional(),
      }),
    )
    .min(1, '少なくとも 1 件のタスクを選択してください'),
});

// 登録: 日報 + 明細を作成し、各タスクの進捗率を更新(最新が勝つ → ガント/全体進捗へ反映)
dailyReports.post('/', zValidator('json', createInput), async (c) => {
  const { projectId, memberId, reportDate, note, entries } = c.req.valid('json');
  const created = await prisma.$transaction(async (tx) => {
    const report = await tx.dailyReport.create({
      data: {
        projectId,
        memberId,
        reportDate: new Date(`${reportDate}T00:00:00.000Z`),
        note,
      },
    });
    for (const e of entries) {
      await tx.progressReport.create({
        data: {
          dailyReportId: report.id,
          taskId: e.taskId,
          memberId,
          progress: e.progress,
          comment: e.comment,
        },
      });
      await tx.task.update({ where: { id: e.taskId }, data: { progress: e.progress } });
    }
    return report;
  });
  return c.json(created, 201);
});
