import { describe, it, expect } from 'vitest';
import { createApp } from './app.js';

// DB へ接続しない経路のみを検証する(health / 404 / バリデーション 400)。
// DB を伴う統合テストは migrate 済みの SQLite を用意して別途追加する。
const app = createApp();

describe('GET /api/health', () => {
  it('200 と status:ok を返す', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('未定義ルート', () => {
  it('404 を返す', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/members バリデーション', () => {
  it('name が無いと 400(DB へ到達しない)', async () => {
    const res = await app.request('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'SE' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/members email バリデーション', () => {
  it('email が不正形式だと 400', async () => {
    const res = await app.request('/api/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '山田', email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/holidays バリデーション', () => {
  it('date が不正形式だと 400', async () => {
    const res = await app.request('/api/holidays', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '2026/01/01', name: '元日' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/projects バリデーション', () => {
  it('name が無いと 400', async () => {
    const res = await app.request('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'x' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('requirements バリデーション', () => {
  it('POST で content が無いと 400', async () => {
    const res = await app.request('/api/requirements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'p1' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET で projectId 未指定だと 400', async () => {
    const res = await app.request('/api/requirements');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tasks バリデーション', () => {
  it('name が無いと 400', async () => {
    const res = await app.request('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'p1' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/tasks/:id バリデーション', () => {
  it('estimateDays が負だと 400', async () => {
    const res = await app.request('/api/tasks/t1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ estimateDays: -1 }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tasks utilizationRate バリデーション', () => {
  it('稼働率が 1 を超えると 400', async () => {
    const res = await app.request('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'p1', name: 'x', utilizationRate: 1.5 }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tasks/schedule バリデーション', () => {
  it('startDate の形式が不正だと 400', async () => {
    const res = await app.request('/api/tasks/schedule', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'p1', startDate: '2026/06/08' }),
    });
    expect(res.status).toBe(400);
  });
});
