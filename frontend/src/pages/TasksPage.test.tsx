import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TasksPage from './TasksPage';

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

const project = { id: 'p1', name: '案件A', description: null, createdAt: '' };
const requirement = { id: 'r1', projectId: 'p1', content: 'ログイン機能', source: null, createdAt: '' };

describe('TasksPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('要件を「タスク化」するとタスク一覧に追加される', async () => {
    const created = {
      id: 't1',
      projectId: 'p1',
      requirementId: 'r1',
      name: 'ログイン機能',
      estimateDays: 0,
      plannedStart: null,
      plannedEnd: null,
      progress: 0,
      assigneeId: null,
    };
    mockFetch((url, init) => {
      if (url.includes('/api/projects')) return [project];
      if (url.includes('/api/requirements')) return [requirement];
      if (url.includes('/api/tasks') && init?.method === 'POST') return created;
      if (url.includes('/api/tasks')) return [];
      return [];
    });

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    const btn = await screen.findByRole('button', { name: 'タスク化' });
    await userEvent.click(btn);

    await waitFor(() => {
      // タスク一覧(ul)内にタスク名が出る
      const lists = screen.getAllByText('ログイン機能');
      expect(lists.length).toBeGreaterThanOrEqual(1);
    });
  });
});
