import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DelaysPage from './DelaysPage';

const project = { id: 'p1', name: '案件A', description: null, createdAt: '' };
const delay = {
  taskId: 't1',
  name: '設計',
  assigneeName: '山田',
  expectedProgress: 50,
  actualProgress: 20,
  behindBy: 30,
  isDelayed: true,
};

describe('DelaysPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('遅延タスクと遅れ要員を表示する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        let body: unknown = [];
        if (url.includes('/api/projects')) body = [project];
        else if (url.includes('/api/tasks/delays/members'))
          body = [{ assigneeId: 'm1', name: '山田', totalBehind: 30, taskIds: ['t1'] }];
        else if (url.includes('/api/tasks/delays')) body = [delay];
        else if (url.includes('/api/tasks/recovery'))
          body = {
            delayedCount: 1,
            totalRemainingDays: 8,
            actions: [
              {
                taskId: 't1',
                taskName: '設計',
                severity: 'high',
                behindBy: 30,
                remainingDays: 8,
                suggestions: ['重度の遅延。応援要員の追加投入とスコープ(優先度)の見直しを検討する'],
              },
            ],
          };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    render(
      <MemoryRouter>
        <DelaysPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('設計').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('▲ 30%')).toBeInTheDocument();
    // 遅れ要員セクション
    await waitFor(() => expect(screen.getByText('累計遅れ 30%')).toBeInTheDocument());
    expect(screen.getByText(/遅延タスク 1 件/)).toBeInTheDocument();
    // リカバリプラン (US-011)
    await waitFor(() =>
      expect(screen.getByText(/応援要員の追加投入/)).toBeInTheDocument(),
    );
    expect(screen.getByText('重度')).toBeInTheDocument();
  });
});
