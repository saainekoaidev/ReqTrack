import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { prisma } from '../db.js';
import { isTextLike, shouldSkipDir, makeExcerpt } from '../domain/referenceScan.js';
import { sanitizeFtsQuery } from '../domain/fts.js';

// FTS5(trigram)索引を必要時に作成する (US-035)。仮想テーブルは Prisma スキーマ外。
async function ensureFts(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE VIRTUAL TABLE IF NOT EXISTS "ReferenceFileFts" USING fts5(refId UNINDEXED, path, excerpt, tokenize='trigram')`,
  );
}

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
// 読めるテキスト系ファイルのみ登録する(バイナリは数えるが取込まない)。
// 恣意的な少件数では打ち切らず、安全上限に達した場合のみ truncated を返す。
const MAX_TEXT_FILES = 20000; // 取込(登録)するテキストファイルの安全上限
const MAX_EXCERPT_BYTES = 1024 * 1024; // 抜粋対象とする最大ファイルサイズ(1MB)
const MAX_DEPTH = 24;
const INSERT_CHUNK = 1000;

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
  let totalFiles = 0; // 走査した全ファイル数(バイナリ含む)
  let truncated = false;

  async function walk(dir: string, depth: number): Promise<void> {
    if (truncated || depth > MAX_DEPTH) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (truncated) break;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (shouldSkipDir(e.name)) continue;
        await walk(full, depth + 1);
      } else if (e.isFile()) {
        totalFiles += 1;
        const ext = extname(e.name).toLowerCase();
        if (!isTextLike(ext)) continue; // バイナリ等は数えるが取込まない
        if (collected.length >= MAX_TEXT_FILES) {
          truncated = true;
          break;
        }
        let size = 0;
        try {
          size = (await stat(full)).size;
        } catch {
          continue;
        }
        let excerpt: string | null = null;
        if (size <= MAX_EXCERPT_BYTES) {
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

  // 既存を削除してから分割 insert(大量行対策)
  await prisma.referenceFile.deleteMany({ where: { referenceProjectId: id } });
  for (let i = 0; i < collected.length; i += INSERT_CHUNK) {
    const chunk = collected.slice(i, i + INSERT_CHUNK);
    await prisma.referenceFile.createMany({
      data: chunk.map((f) => ({ ...f, referenceProjectId: id })),
    });
  }
  await prisma.referenceProject.update({ where: { id }, data: { scannedAt: new Date() } });

  // 全文検索インデックスを再構築 (US-035)
  try {
    await ensureFts();
    await prisma.$executeRawUnsafe('DELETE FROM "ReferenceFileFts" WHERE refId = ?', id);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ReferenceFileFts"(refId, path, excerpt)
       SELECT "referenceProjectId", "path", "excerpt" FROM "ReferenceFile"
       WHERE "referenceProjectId" = ? AND "excerpt" IS NOT NULL`,
      id,
    );
  } catch {
    // FTS 非対応環境でもスキャン自体は成功扱い(検索のみ不可)
  }

  return c.json({ scanned: collected.length, totalFiles, truncated });
});

// 全文検索 (US-035)。AI 見積の文脈取得に使う。
const searchQuery = z.object({ q: z.string().min(1), limit: z.coerce.number().int().min(1).max(200).optional() });
referenceProjects.get('/:id/search', zValidator('query', searchQuery), async (c) => {
  const id = c.req.param('id');
  const { q, limit = 50 } = c.req.valid('query');
  const match = sanitizeFtsQuery(q);
  let rows: { path: string; excerpt: string | null }[] = [];
  if (match) {
    try {
      await ensureFts();
      rows = await prisma.$queryRawUnsafe<{ path: string; excerpt: string | null }[]>(
        `SELECT path, excerpt FROM "ReferenceFileFts" WHERE refId = ? AND "ReferenceFileFts" MATCH ? LIMIT ?`,
        id,
        match,
        limit,
      );
    } catch {
      rows = [];
    }
  }
  // FTS が 0 件(短語/CJK 等)なら部分一致でフォールバック
  if (rows.length === 0) {
    const like = await prisma.referenceFile.findMany({
      where: {
        referenceProjectId: id,
        OR: [{ excerpt: { contains: q } }, { path: { contains: q } }],
      },
      select: { path: true, excerpt: true },
      take: limit,
    });
    rows = like;
  }
  return c.json(rows);
});

referenceProjects.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await prisma.referenceProject.delete({ where: { id } });
  return c.body(null, 204);
});
