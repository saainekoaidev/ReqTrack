import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// サーバ側フォルダブラウザ (US-031)。フォルダ選択の「参照」で実パスを選ぶために使う。
// ローカル単一利用ツール前提。ディレクトリのみ返す。
export const fsBrowse = new Hono();

const listQuery = z.object({ path: z.string().optional() });

async function windowsDrives(): Promise<{ name: string; path: string }[]> {
  const drives: { name: string; path: string }[] = [];
  for (const l of 'CDEFGABHIJKLMNOPQRSTUVWXYZ') {
    const root = `${l}:\\`;
    try {
      await stat(root);
      drives.push({ name: `${l}:`, path: root });
    } catch {
      // ドライブ無し
    }
  }
  return drives;
}

fsBrowse.get('/list', zValidator('query', listQuery), async (c) => {
  const { path } = c.req.valid('query');
  if (!path) {
    // ルート(Windows ドライブ一覧)
    return c.json({ path: '', parent: null, entries: await windowsDrives() });
  }
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch {
    return c.json({ error: `フォルダを開けません: ${path}` }, 400);
  }
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, path: join(path, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const parent = dirname(path);
  return c.json({ path, parent: parent === path ? null : parent, entries: dirs });
});
