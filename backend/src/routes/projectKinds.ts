import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { KIND_SEED, MIGRATION_TEMPLATE } from '../domain/templates.js';

// 案件区分マスタ (US-060)。初回アクセス時に初期データを投入する。
export const projectKinds = new Hono();

let seeded = false;
async function ensureSeed() {
  if (seeded) return;
  const count = await prisma.projectKind.count();
  if (count === 0) {
    await prisma.projectKind.createMany({ data: KIND_SEED });
  }
  const tmplCount = await prisma.estimateTemplate.count();
  if (tmplCount === 0) {
    await prisma.estimateTemplate.create({
      data: {
        name: MIGRATION_TEMPLATE.name,
        projectKind: MIGRATION_TEMPLATE.projectKind,
        items: MIGRATION_TEMPLATE.items as unknown as Prisma.InputJsonValue,
      },
    });
  }
  seeded = true;
}

const kindInput = z.object({
  name: z.string().min(1),
  note: z.string().optional(),
  requiresReference: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

projectKinds.get('/', async (c) => {
  await ensureSeed();
  const list = await prisma.projectKind.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  return c.json(list);
});

projectKinds.post('/', zValidator('json', kindInput), async (c) => {
  await ensureSeed();
  const created = await prisma.projectKind.create({ data: c.req.valid('json') });
  return c.json(created, 201);
});

projectKinds.put('/:id', zValidator('json', kindInput), async (c) => {
  const updated = await prisma.projectKind.update({ where: { id: c.req.param('id') }, data: c.req.valid('json') });
  return c.json(updated);
});

projectKinds.delete('/:id', async (c) => {
  await prisma.projectKind.delete({ where: { id: c.req.param('id') } });
  return c.body(null, 204);
});
