// .env (DATABASE_URL / PORT) を最初に読み込む。Prisma Client は実行時に .env を
// 自動ロードしないため、db.ts(PrismaClient 生成)より前に必ず実行する。
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app.js';

// 既定ポートは 8788(DGMS の 8787 と衝突しないようにずらしている)
const port = Number(process.env.PORT ?? 8788);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ReqTrack API listening on http://localhost:${info.port}`);
});
