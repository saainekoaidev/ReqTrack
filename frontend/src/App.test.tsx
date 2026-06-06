import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('要員一覧を取得して表示する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify([{ id: '1', name: '山田 太郎', role: 'SE', email: null, createdAt: '' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    render(<App />);
    expect(screen.getByRole('heading', { name: 'ReqTrack' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/山田 太郎/)).toBeInTheDocument());
  });

  it('API 失敗時はエラーを表示する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );

    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
