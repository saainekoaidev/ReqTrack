import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';
import { toDateKey } from '../domain/schedule.js';

// 祝日マスタ (US-006 / 自動取得 US-025)
export const holidays = new Hono();

const holidayInput = z.object({
  // YYYY-MM-DD
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date は YYYY-MM-DD 形式'),
  name: z.string().min(1),
});

// 日本の祝日を外部カレンダーから一括取得 (US-025)
const importQuery = z.object({ year: z.string().regex(/^\d{4}$/, 'year は 4 桁') });

holidays.post('/import', zValidator('query', importQuery), async (c) => {
  const { year } = c.req.valid('query');
  let data: Record<string, string>;
  try {
    const res = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`);
    if (!res.ok) return c.json({ error: `祝日カレンダーの取得に失敗しました (HTTP ${res.status})` }, 502);
    data = (await res.json()) as Record<string, string>;
  } catch {
    return c.json({ error: '祝日カレンダーに接続できませんでした(オフライン/プロキシの可能性)' }, 502);
  }
  const existing = new Set((await prisma.holiday.findMany()).map((h) => toDateKey(h.date)));
  let added = 0;
  for (const [date, name] of Object.entries(data)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || existing.has(date)) continue;
    await prisma.holiday.create({ data: { date: new Date(`${date}T00:00:00.000Z`), name } });
    added += 1;
  }
  return c.json({ year, added, fetched: Object.keys(data).length });
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
