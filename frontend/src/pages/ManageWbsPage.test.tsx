import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProjectProvider } from '../context/ProjectContext';
import ManageWbsPage from './ManageWbsPage';

const project = { id: 'p1', name: '案件A', description: null, createdAt: '', hasSchedule: true };
const leaf = {
  id: 't1',
  projectId: 'p1',
  requirementId: null,
  name: '設計',
  level: 3,
  wbsId: '1.1.1',
  parentId: null,
  phase: '基本設計',
  estimateNote: null,
  kind: 'task',
  estimateDays: 1,
  utilizationRate: 1,
  plannedStart: '2026-06-08T09:00:00Z',
  plannedEnd: '2026-06-08T17:00:00Z',
  progress: 0,
  assigneeId: null,
};

describe('ManageWbsPage (US-041)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('WBS編集テーブルを表示し、スケジュール再生成で schedule API を呼ぶ', async () => {
    let rescheduled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/settings')) body = { minEstimateDays: 0.1 };
        else if (url.includes('/api/members')) body = [];
        else if (url.includes('/api/tasks/schedule') && init?.method === 'POST') {
          rescheduled = true;
          body = [leaf];
        } else if (url.includes('/api/projects')) body = [project];
        else if (url.includes('/api/tasks')) body = [leaf];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    localStorage.setItem('reqtrack.projectId', 'p1');
    render(
      <MemoryRouter>
        <ProjectProvider>
          <ManageWbsPage />
        </ProjectProvider>
      </MemoryRouter>,
    );

    // 編集テーブルに作業が出る
    await waitFor(() => expect(screen.getByLabelText('1.1.1 の名称')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'スケジュールを再生成' }));
    await waitFor(() => expect(rescheduled).toBe(true));
    expect(await screen.findByText(/スケジュールを再生成しました/)).toBeInTheDocument();
  });
});
