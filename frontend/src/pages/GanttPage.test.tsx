import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProjectProvider } from '../context/ProjectContext';
import GanttPage from './GanttPage';

const project = { id: 'p1', name: '案件A', description: null, createdAt: '' };
const scheduled = [
  {
    id: 't1',
    projectId: 'p1',
    requirementId: null,
    name: '設計',
    estimateDays: 3,
    plannedStart: '2026-06-08T00:00:00Z',
    plannedEnd: '2026-06-10T00:00:00Z',
    progress: 0,
    assigneeId: null,
  },
];

describe('GanttPage', () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it('スケジュールを再生成するとバーが描画される', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/projects')) body = [project];
        else if (url.includes('/api/tasks/schedule') && init?.method === 'POST') body = scheduled;
        else if (url.includes('/api/tasks')) body = []; // 初期は計画なし
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    render(
      <MemoryRouter>
          <ProjectProvider>
            <GanttPage />
          </ProjectProvider>
        </MemoryRouter>,
    );

    // 初期は計画なしのメッセージ
    await waitFor(() =>
      expect(screen.getByText(/計画日が設定されたタスクがありません/)).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => expect(screen.getByRole('table', { name: 'ガントチャート' })).toBeInTheDocument());
    // 葉行の名称はインライン編集の input として表示される (US-046)
    expect(screen.getByDisplayValue('設計')).toBeInTheDocument();
  });
});
