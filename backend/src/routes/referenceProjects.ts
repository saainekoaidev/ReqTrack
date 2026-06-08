import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { prisma } from '../db.js';
import { isTextLike, shouldSkipDir, makeExcerpt } from '../domain/referenceScan.js';

// 参照資料プロジェクト (US-024)。既存改修の資料フォルダを登録・スキャンし見積の参照にする。
export const referenceProjects = new Hono();

referenceProjects.get('/', async (c) => {
  const list = await prisma.referenceProject.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { files: true } } },
  });
  return c.json(list);
});

referenceProjects.get('/:id', async (c) => {
  const id = c.req.param('id');
  const rp = await prisma.referenceProject.findUnique({
    where: { id },
    include: { files: { orderBy: { path: 'asc' } } },
  });
  if (!rp) return c.json({ error: 'Not Found' }, 404);
  return c.json(rp);
});

const createInput = z.object({
  name: z.string().min(1),
  rootPath: z.string().min(1),
  note: z.string().optional(),
});

referenceProjects.post('/', zValidator('json', createInput), async (c) => {
  const data = c.req.valid('json');
  const created = await prisma.referenceProject.create({ data });
  return c.json(created, 201);
});

// スキャン: rootPath 配下を走査し ReferenceFile を再構築する(冪等)。
const MAX_FILES = 2000;
const MAX_EXCERPT_BYTES = 200 * 1024;

referenceProjects.post('/:id/scan', async (c) => {
  const id = c.req.param('id');
  const rp = await prisma.referenceProject.findUnique({ where: { id } });
  if (!rp) return c.json({ error: 'Not Found' }, 404);
  const rootPath = rp.rootPath;

  try {
    const root = await stat(rootPath);
    if (!root.isDirectory()) {
      return c.json({ error: `指定先はフォルダではありません: ${rootPath}` }, 400);
    }
  } catch {
    return c.json(
      {
        error: `資料フォルダが見つかりません: 「${rootPath}」。「参照」ボタンから実在するフォルダを選び直してください(絶対パスが必要です)。`,
      },
      400,
    );
  }

  const collected: { path: string; size: number; ext: string; excerpt: string | null }[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (collected.length >= MAX_FILES || depth > 8) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (collected.length >= MAX_FILES) break;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (shouldSkipDir(e.name)) continue;
        await walk(full, depth + 1);
      } else if (e.isFile()) {
        const ext = extname(e.name).toLowerCase();
        let size = 0;
        try {
          size = (await stat(full)).size;
        } catch {
          continue;
        }
        let excerpt: string | null = null;
        if (isTextLike(ext) && size <= MAX_EXCERPT_BYTES) {
          try {
            excerpt = makeExcerpt(await readFile(full, 'utf-8'));
          } catch {
            excerpt = null;
          }
        }
        collected.push({ path: relative(rootPath, full), size, ext, excerpt });
      }
    }
  }

  await walk(rootPath, 0);

  await prisma.$transaction([
    prisma.referenceFile.deleteMany({ where: { referenceProjectId: id } }),
    prisma.referenceFile.createMany({
      data: collected.map((f) => ({ ...f, referenceProjectId: id })),
    }),
    prisma.referenceProject.update({ where: { id }, data: { scannedAt: new Date() } }),
  ]);

  return c.json({ scanned: collected.length });
});

referenceProjects.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await prisma.referenceProject.delete({ where: { id } });
  return c.body(null, 204);
});
