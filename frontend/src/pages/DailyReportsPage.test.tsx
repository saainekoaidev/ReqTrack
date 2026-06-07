import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DailyReportsPage from './DailyReportsPage';

const project = { id: 'p1', name: '案件A', description: null, createdAt: '' };
const member = { id: 'm1', name: '山田', role: null, email: null, createdAt: '' };
const task = {
  id: 't1',
  projectId: 'p1',
  requirementId: null,
  name: '設計',
  estimateDays: 1,
  utilizationRate: 1,
  plannedStart: null,
  plannedEnd: null,
  progress: 0,
  assigneeId: null,
  level: 3,
  wbsId: '1.1',
  parentId: null,
  phase: '基本設計',
  estimateNote: null,
  kind: 'task',
};

describe('DailyReportsPage (US-017)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('複数タスクを選んで日報を登録すると一覧に蓄積される', async () => {
    let created = false;
    const report = {
      id: 'dr1',
      projectId: 'p1',
      memberId: 'm1',
      reportDate: '2026-06-07T00:00:00.000Z',
      note: '順調',
      createdAt: '',
      member,
      _count: { entries: 1 },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/projects')) body = [project];
        else if (url.includes('/api/members')) body = [member];
        else if (url.includes('/api/tasks')) body = [task];
        else if (url.includes('/api/daily-reports') && init?.method === 'POST') {
          created = true;
          body = report;
        } else if (url.includes('/api/daily-reports')) body = created ? [report] : [];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    render(
      <MemoryRouter>
        <DailyReportsPage />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: '新規登録' }));
    // ダイアログ内でタスクを選択し進捗入力
    await userEvent.click(await screen.findByLabelText('設計 を選択'));
    const progress = screen.getByLabelText('設計 の進捗率');
    await userEvent.clear(progress);
    await userEvent.type(progress, '40');
    await userEvent.click(screen.getByRole('button', { name: '登録' }));

    // 反映メッセージ + 一覧に行が増える(報告日セルで確認)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('反映'));
    await waitFor(() => expect(screen.getByText('2026-06-07')).toBeInTheDocument());
  });
});
