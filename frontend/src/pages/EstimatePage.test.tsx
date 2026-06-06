import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EstimatePage from './EstimatePage';

const project = { id: 'p1', name: '案件A', description: null, createdAt: '' };
const task = {
  id: 't1',
  projectId: 'p1',
  requirementId: null,
  name: '設計',
  estimateDays: 0,
  plannedStart: null,
  plannedEnd: null,
  progress: 0,
  assigneeId: null,
};

describe('EstimatePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('見積を入力して保存すると合計に反映される', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/projects')) body = [project];
        else if (url.includes('/api/tasks/') && init?.method === 'PATCH')
          body = { ...task, estimateDays: 3 };
        else if (url.includes('/api/tasks')) body = [task];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    render(
      <MemoryRouter>
        <EstimatePage />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText('設計 の工数');
    await userEvent.clear(input);
    await userEvent.type(input, '3');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(screen.getByText('3 人日')).toBeInTheDocument());
  });
});
