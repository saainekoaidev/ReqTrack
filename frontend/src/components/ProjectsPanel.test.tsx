import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectsPanel from './ProjectsPanel';

describe('ProjectsPanel (US-030)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('プロジェクトを一覧表示し、削除できる', async () => {
    let deleted = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/api/projects') && init?.method === 'DELETE') {
          deleted = true;
          return new Response(null, { status: 204 });
        }
        const body = deleted ? [] : [{ id: 'p1', name: '不要案件', description: null, createdAt: '' }];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    render(<ProjectsPanel />);

    await waitFor(() => expect(screen.getByText('不要案件')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '削除' }));
    await waitFor(() => expect(screen.getByText('プロジェクトがありません。')).toBeInTheDocument());
  });
});
