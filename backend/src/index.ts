import { serve } from '@hono/node-server';
import { app } from './app.js';

// 既定ポートは 8788(DGMS の 8787 と衝突しないようにずらしている)
const port = Number(process.env.PORT ?? 8788);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ReqTrack API listening on http://localhost:${info.port}`);
});
