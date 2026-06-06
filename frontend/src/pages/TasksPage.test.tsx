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
      // タスク一覧内にタスク名が出る
      const lists = screen.getAllByText('ログイン機能');
      expect(lists.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('「標準工程を展開」で標準工程タスクが生成される (US-013)', async () => {
    let expanded = false;
    const phases = ['基本設計', '詳細設計', 'コーディング', '単体テスト', '結合テスト'];
    mockFetch((url, init) => {
      if (url.includes('/api/projects')) return [project];
      if (url.includes('/api/requirements/r1/expand') && init?.method === 'POST') {
        expanded = true;
        return [];
      }
      if (url.includes('/api/requirements')) return [requirement];
      if (url.includes('/api/tasks')) {
        return expanded
          ? phases.map((p, i) => ({
              id: `t${i}`,
              projectId: 'p1',
              requirementId: 'r1',
              name: p,
              estimateDays: 0,
              utilizationRate: 1,
              plannedStart: null,
              plannedEnd: null,
              progress: 0,
              assigneeId: null,
              level: 3,
              wbsId: `1.${i + 1}`,
              parentId: 'f',
              phase: p,
              estimateNote: null,
              kind: 'task',
            }))
          : [];
      }
      return [];
    });

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    const btn = await screen.findByRole('button', { name: '標準工程を展開' });
    await userEvent.click(btn);

    await waitFor(() => expect(screen.getByText('1.1')).toBeInTheDocument());
    expect(screen.getByText('1.5')).toBeInTheDocument();
    // 工程列とタスク名列に出るため複数一致
    expect(screen.getAllByText('基本設計').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('結合テスト').length).toBeGreaterThanOrEqual(1);
  });

  it('「レビューを自動展開」でレビュータスクが表示される (US-014)', async () => {
    let reviewed = false;
    mockFetch((url, init) => {
      if (url.includes('/api/projects/p1/expand-reviews') && init?.method === 'POST') {
        reviewed = true;
        return [];
      }
      if (url.includes('/api/projects')) return [project];
      if (url.includes('/api/requirements')) return [requirement];
      if (url.includes('/api/tasks')) {
        return reviewed
          ? [
              {
                id: 'rv1',
                projectId: 'p1',
                requirementId: 'r1',
                name: '基本設計レビュー',
                estimateDays: 0.6,
                utilizationRate: 1,
                plannedStart: null,
                plannedEnd: null,
                progress: 0,
                assigneeId: null,
                level: 3,
                wbsId: '1r設',
                parentId: 'f',
                phase: '基本設計レビュー',
                estimateNote: null,
                kind: 'review',
              },
            ]
          : [];
      }
      return [];
    });

    render(
      <MemoryRouter>
        <TasksPage />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'レビューを自動展開' }));
    await waitFor(() => expect(screen.getByText('1r設')).toBeInTheDocument());
    expect(screen.getByText('レビュー')).toBeInTheDocument(); // バッジ
  });
});
