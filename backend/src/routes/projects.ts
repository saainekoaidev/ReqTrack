import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';

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
