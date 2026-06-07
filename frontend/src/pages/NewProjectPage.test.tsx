import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NewProjectPage from './NewProjectPage';

describe('NewProjectPage (US-020)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('「見積から始める」でプロジェクト作成し取込画面へ遷移', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ id: 'pNew', name: '新案件', description: null, createdAt: '' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/new" element={<NewProjectPage />} />
          <Route path="/import" element={<div>IMPORT_STUB</div>} />
          <Route path="/wbs" element={<div>WBS_STUB</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('プロジェクト名'), '新案件');
    await userEvent.click(screen.getByRole('button', { name: /見積から始める/ }));

    await waitFor(() => expect(screen.getByText('IMPORT_STUB')).toBeInTheDocument());
  });

  it('「ガントから始める」で WBS 編集へ遷移', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ id: 'pNew', name: '新案件', description: null, createdAt: '' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/new" element={<NewProjectPage />} />
          <Route path="/import" element={<div>IMPORT_STUB</div>} />
          <Route path="/wbs" element={<div>WBS_STUB</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('プロジェクト名'), '新案件');
    await userEvent.click(screen.getByRole('button', { name: /ガントから始める/ }));

    await waitFor(() => expect(screen.getByText('WBS_STUB')).toBeInTheDocument());
  });
});
