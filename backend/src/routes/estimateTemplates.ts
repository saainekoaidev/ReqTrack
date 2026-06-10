import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { naturalWbsCompare } from '../domain/estimate.js';
import type { TemplateItem } from '../domain/templates.js';

// 見積/タスクの標準テンプレート (US-060)。一覧 / プロジェクトから保存 / 削除。
export const estimateTemplates = new Hono();

estimateTemplates.get('/', async (c) => {
  const list = await prisma.estimateTemplate.findMany({ orderBy: { createdAt: 'asc' } });
  return c.json(
    list.map((t) => ({
      id: t.id,
      name: t.name,
      projectKind: t.projectKind,
      itemCount: Array.isArray(t.items) ? (t.items as unknown[]).length : 0,
    })),
  );
});

// 既存プロジェクトの WBS をテンプレートとして保存する
const fromProjectInput = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  projectKind: z.string().optional(),
});
estimateTemplates.post('/from-project', zValidator('json', fromProjectInput), async (c) => {
  const { projectId, name, projectKind } = c.req.valid('json');
  const tasks = await prisma.task.findMany({ where: { projectId, kind: { not: 'efficiency' } } });
  const items: TemplateItem[] = [...tasks]
    .sort((a, b) => naturalWbsCompare(a.wbsId, b.wbsId))
    .filter((t) => t.wbsId)
    .map((t) => ({
      wbsId: t.wbsId!,
      level: t.level,
      name: t.name,
      phase: t.phase ?? undefined,
      estimateDays: t.estimateDays,
      utilizationRate: t.utilizationRate,
      note: t.estimateNote ?? undefined,
    }));
  const created = await prisma.estimateTemplate.create({
    data: { name, projectKind, items: items as unknown as Prisma.InputJsonValue },
  });
  return c.json({ id: created.id, name: created.name, itemCount: items.length }, 201);
});

estimateTemplates.delete('/:id', async (c) => {
  await prisma.estimateTemplate.delete({ where: { id: c.req.param('id') } });
  return c.body(null, 204);
});
