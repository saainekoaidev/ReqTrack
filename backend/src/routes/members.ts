import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';

// 要員マスタ (US-005)
export const members = new Hono();

const memberInput = z.object({
  name: z.string().min(1),
  role: z.string().min(1).optional(),
  email: z.string().email().optional(),
  hourlyRate: z.number().nonnegative().optional(),
});

members.get('/', async (c) => {
  const list = await prisma.member.findMany({ orderBy: { createdAt: 'asc' } });
  return c.json(list);
});

members.post('/', zValidator('json', memberInput), async (c) => {
  const data = c.req.valid('json');
  const created = await prisma.member.create({ data });
  return c.json(created, 201);
});

members.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await prisma.member.delete({ where: { id } });
  return c.body(null, 204);
});
