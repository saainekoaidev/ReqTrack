import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';

// 要件 (US-001)。顧客ヒアリング/提示された要件を受け取り、プロジェクトに紐づけて保持する。
export const requirements = new Hono();

const requirementInput = z.object({
  projectId: z.string().min(1),
  content: z.string().min(1),
  source: z.string().optional(),
});

// GET /api/requirements?projectId=xxx (projectId 必須)
const listQuery = z.object({ projectId: z.string().min(1) });

requirements.get('/', zValidator('query', listQuery), async (c) => {
  const { projectId } = c.req.valid('query');
  const list = await prisma.requirement.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });
  return c.json(list);
});

requirements.post('/', zValidator('json', requirementInput), async (c) => {
  const data = c.req.valid('json');
  const created = await prisma.requirement.create({ data });
  return c.json(created, 201);
});

requirements.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await prisma.requirement.delete({ where: { id } });
  return c.body(null, 204);
});
