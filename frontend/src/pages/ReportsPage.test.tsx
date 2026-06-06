import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from './ReportsPage';

const project = { id: 'p1', name: '案件A', description: null, createdAt: '' };
const member = { id: 'm1', name: '山田', role: null, email: null, createdAt: '' };
const task = {
  id: 't1',
  projectId: 'p1',
  requirementId: null,
  name: '設計',
  estimateDays: 2,
  plannedStart: null,
  plannedEnd: null,
  progress: 0,
  assigneeId: null,
};

describe('ReportsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('進捗を報告するとタスクの現在値に反映される', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/projects')) body = [project];
        else if (url.includes('/api/members')) body = [member];
        else if (url.includes('/reports') && init?.method === 'POST') body = { id: 'rep1' };
        else if (url.includes('/api/tasks')) body = [task];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>,
    );

    const memberSelect = await screen.findByLabelText('設計 の報告者');
    await userEvent.selectOptions(memberSelect, 'm1');
    const progressInput = screen.getByLabelText('設計 の進捗率');
    await userEvent.clear(progressInput);
    await userEvent.type(progressInput, '50');
    await userEvent.click(screen.getByRole('button', { name: '報告' }));

    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('50%');
  });
});
