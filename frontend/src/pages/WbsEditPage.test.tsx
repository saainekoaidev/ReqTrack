import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WbsEditPage from './WbsEditPage';
import { CreateProvider } from '../context/CreateContext';

const project = { id: 'p1', name: '案件A', description: null, kind: 'new', createdAt: '' };

function feature(id: string, wbsId: string) {
  return {
    id,
    projectId: 'p1',
    requirementId: null,
    name: '機能',
    estimateDays: 0,
    utilizationRate: 1,
    plannedStart: null,
    plannedEnd: null,
    progress: 0,
    assigneeId: null,
    level: 1,
    wbsId,
    parentId: null,
    phase: null,
    estimateNote: null,
    kind: 'task',
  };
}

describe('WbsEditPage (US-018 / US-038)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('「機能を追加」で level1 タスクが作成され一覧に出る', async () => {
    let added = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/projects')) body = [project];
        else if (url.includes('/api/members')) body = [];
        else if (url.includes('/api/tasks') && init?.method === 'POST') {
          added = true;
          body = feature('t1', '1');
        } else if (url.includes('/api/tasks')) body = added ? [feature('t1', '1')] : [];
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
          <WbsEditPage />
        </CreateProvider>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: '機能を追加' }));
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    // 名称編集フィールドが出る
    expect(screen.getByLabelText('1 の名称')).toBeInTheDocument();
  });
});
