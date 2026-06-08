import { prisma } from './db.js';
import { sanitizeFtsQuery } from './domain/fts.js';

// 参照資料の全文検索(FTS5 + フォールバック) (US-035/036)。AI 見積の文脈取得に使う。
export async function ensureFts(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE VIRTUAL TABLE IF NOT EXISTS "ReferenceFileFts" USING fts5(refId UNINDEXED, path, excerpt, tokenize='trigram')`,
  );
}

export async function searchReferences(
  referenceProjectId: string,
  q: string,
  limit = 5,
): Promise<{ path: string; excerpt: string | null }[]> {
  const match = sanitizeFtsQuery(q);
  if (match) {
    try {
      await ensureFts();
      const rows = await prisma.$queryRawUnsafe<{ path: string; excerpt: string | null }[]>(
        `SELECT path, excerpt FROM "ReferenceFileFts" WHERE refId = ? AND "ReferenceFileFts" MATCH ? LIMIT ?`,
        referenceProjectId,
        match,
        limit,
      );
      if (rows.length > 0) return rows;
    } catch {
      // フォールバックへ
    }
  }
  return prisma.referenceFile.findMany({
    where: {
      referenceProjectId,
      OR: [{ excerpt: { contains: q } }, { path: { contains: q } }],
    },
    select: { path: true, excerpt: true },
    take: limit,
  });
}
