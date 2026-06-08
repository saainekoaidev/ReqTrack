import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EstimatePage from './EstimatePage';
import { CreateProvider } from '../context/CreateContext';

const project = { id: 'p1', name: '案件A', description: null, kind: 'new', createdAt: '' };
const task = {
  id: 't1',
  projectId: 'p1',
  requirementId: null,
  name: '設計',
  level: 3,
  estimateDays: 0,
  utilizationRate: 1,
  plannedStart: null,
  plannedEnd: null,
  progress: 0,
  assigneeId: null,
};

describe('EstimatePage (US-038)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('見積を入力して保存すると合計に反映される', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/settings')) body = { minEstimateDays: 0.1 };
        else if (url.includes('/api/projects')) body = [project];
        else if (url.includes('/api/tasks/') && init?.method === 'PATCH')
          body = { ...task, estimateDays: 3 };
        else if (url.includes('/api/tasks')) body = [task];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    localStorage.setItem('reqtrack.createProjectId', 'p1');
    render(
      <MemoryRouter>
        <CreateProvider>
          <EstimatePage />
        </CreateProvider>
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText('設計 の工数');
    await userEvent.clear(input);
    await userEvent.type(input, '3');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(screen.getByText('3 人日')).toBeInTheDocument());
  });

  it('AI見積を生成してもガントへ直行せず確認テーブルを表示する (US-039)', async () => {
    let generated = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/settings')) body = { minEstimateDays: 0.1 };
        else if (url.includes('/api/members')) body = [];
        else if (url.includes('/ai-estimate') && init?.method === 'POST') {
          generated = true;
          body = { features: 1, tasks: 1 };
        } else if (url.includes('/api/projects')) body = [project];
        else if (url.includes('/api/tasks')) body = generated ? [task] : [];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    localStorage.setItem('reqtrack.createProjectId', 'p1');
    render(
      <MemoryRouter initialEntries={['/create/estimate']}>
        <CreateProvider>
          <Routes>
            <Route path="/create/estimate" element={<EstimatePage />} />
            <Route path="/manage/gantt" element={<div>GANTT_STUB</div>} />
          </Routes>
        </CreateProvider>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'AI で見積を生成' }));

    // 確認テーブル(担当割付つき)が出て、ガントには遷移していない
    await waitFor(() => expect(screen.getByLabelText('設計 の担当')).toBeInTheDocument());
    expect(screen.queryByText('GANTT_STUB')).toBeNull();
    expect(screen.getByRole('button', { name: 'この見積でガントを作成 →' })).toBeInTheDocument();
  });
});
