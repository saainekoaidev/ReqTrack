import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';

// 祝日マスタ (US-006)
export const holidays = new Hono();

const holidayInput = z.object({
  // YYYY-MM-DD
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date は YYYY-MM-DD 形式'),
  name: z.string().min(1),
});

holidays.get('/', async (c) => {
  const list = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  return c.json(list);
});

holidays.post('/', zValidator('json', holidayInput), async (c) => {
  const { date, name } = c.req.valid('json');
  const created = await prisma.holiday.create({
    data: { date: new Date(`${date}T00:00:00.000Z`), name },
  });
  return c.json(created, 201);
});

holidays.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await prisma.holiday.delete({ where: { id } });
  return c.body(null, 204);
});
