import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';

// アプリ全体設定 (US-027)。単一行(id="singleton")。範囲制限つきで編集可能。
export const settings = new Hono();

const SINGLETON = 'singleton';
const DEFAULTS = {
  id: SINGLETON,
  hoursPerDay: 8,
  minEstimateDays: 0.1,
  reviewRatio: 0.3,
  reviewMinDays: 0.1,
  defaultUtilization: 1.0,
  dayStartHour: 9,
};

export async function getSettings() {
  return prisma.settings.upsert({ where: { id: SINGLETON }, update: {}, create: DEFAULTS });
}

settings.get('/', async (c) => c.json(await getSettings()));

// 範囲制限(限界値): 適切な上下限を設定
const settingsInput = z.object({
  hoursPerDay: z.number().min(1).max(24),
  minEstimateDays: z.number().min(0.01).max(1),
  reviewRatio: z.number().min(0).max(1),
  reviewMinDays: z.number().min(0).max(5),
  defaultUtilization: z.number().gt(0).max(1),
  dayStartHour: z.number().int().min(0).max(23),
});

settings.put('/', zValidator('json', settingsInput), async (c) => {
  const data = c.req.valid('json');
  const updated = await prisma.settings.upsert({
    where: { id: SINGLETON },
    update: data,
    create: { id: SINGLETON, ...data },
  });
  return c.json(updated);
});
