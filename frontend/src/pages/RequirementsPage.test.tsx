import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RequirementsPage from './RequirementsPage';

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = handler(url, init);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

describe('RequirementsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('プロジェクトの要件を一覧表示する', async () => {
    mockFetch((url) => {
      if (url.includes('/api/projects')) return [{ id: 'p1', name: '案件A', description: null, createdAt: '' }];
      if (url.includes('/api/requirements'))
        return [{ id: 'r1', projectId: 'p1', content: 'ログイン機能が欲しい', source: null, createdAt: '' }];
      return [];
    });

    render(
      <MemoryRouter>
        <RequirementsPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('ログイン機能が欲しい')).toBeInTheDocument());
  });

  it('要件を追加すると一覧に反映される', async () => {
    const created = { id: 'r2', projectId: 'p1', content: '帳票出力が欲しい', source: null, createdAt: '' };
    mockFetch((url, init) => {
      if (url.includes('/api/projects')) return [{ id: 'p1', name: '案件A', description: null, createdAt: '' }];
      if (url.includes('/api/requirements') && init?.method === 'POST') return created;
      if (url.includes('/api/requirements')) return [];
      return [];
    });

    render(
      <MemoryRouter>
        <RequirementsPage />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText('要件内容');
    await userEvent.type(input, '帳票出力が欲しい');
    await userEvent.click(screen.getByRole('button', { name: '要件を追加' }));

    await waitFor(() => expect(screen.getByText('帳票出力が欲しい')).toBeInTheDocument());
  });
});
