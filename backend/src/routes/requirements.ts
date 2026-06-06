import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { prisma } from '../db.js';
import { expandWbs, STANDARD_PHASES } from '../domain/wbs.js';

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

// 要件から WBS(機能→対象→作業タスク)と標準工程を展開する (US-013)
const expandInput = z.object({
  targets: z.array(z.string().min(1)).optional(),
  phases: z.array(z.string().min(1)).optional(),
  assigneeId: z.string().min(1).optional(),
});

requirements.post('/:id/expand', zValidator('json', expandInput), async (c) => {
  const id = c.req.param('id');
  const { targets = [], phases = STANDARD_PHASES, assigneeId } = c.req.valid('json');
  const requirement = await prisma.requirement.findUnique({ where: { id } });
  if (!requirement) return c.json({ error: 'Not Found' }, 404);

  // 機能番号 = 既存 level1 タスク数 + 1
  const featureCount = await prisma.task.count({
    where: { projectId: requirement.projectId, level: 1 },
  });
  const nodes = expandWbs(featureCount + 1, requirement.content, targets, phases);

  // tempId → 実 id を解決しながら順に作成(親が先に来る順序)
  const idMap = new Map<string, string>();
  const created = [];
  for (const n of nodes) {
    const parentId = n.parentTempId ? idMap.get(n.parentTempId) : undefined;
    const task = await prisma.task.create({
      data: {
        projectId: requirement.projectId,
        requirementId: requirement.id,
        name: n.name,
        level: n.level,
        wbsId: n.wbsId,
        phase: n.phase ?? undefined,
        parentId,
        assigneeId, // 機能担当をそのまま全ノードへ継承
        kind: 'task',
      },
    });
    idMap.set(n.tempId, task.id);
    created.push(task);
  }
  return c.json(created, 201);
});
