import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NewProjectPage from './NewProjectPage';
import { CreateProvider } from '../context/CreateContext';

const created = { id: 'pNew', name: '新案件', description: null, kind: 'new', createdAt: '' };

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      let body: unknown = [];
      if (url.includes('/api/projects') && init?.method === 'POST') body = created;
      else if (url.includes('/api/projects')) body = [created];
      else if (url.includes('/api/reference-projects')) body = [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

describe('NewProjectPage (US-020 / US-038)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('プロジェクトを作成すると要件登録へ遷移する', async () => {
    stubFetch();
    render(
      <MemoryRouter initialEntries={['/create']}>
        <CreateProvider>
          <Routes>
            <Route path="/create" element={<NewProjectPage />} />
            <Route path="/create/requirements" element={<div>REQUIREMENTS_STUB</div>} />
          </Routes>
        </CreateProvider>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('プロジェクト名'), '新案件');
    await userEvent.click(screen.getByRole('button', { name: /プロジェクトを作成して次へ/ }));

    await waitFor(() => expect(screen.getByText('REQUIREMENTS_STUB')).toBeInTheDocument());
  });

  it('作成済み(draft)があると入力ではなくロック表示+やり直しを出す', async () => {
    localStorage.setItem('reqtrack.createProjectId', 'pNew');
    stubFetch();
    render(
      <MemoryRouter initialEntries={['/create']}>
        <CreateProvider>
          <Routes>
            <Route path="/create" element={<NewProjectPage />} />
            <Route path="/create/requirements" element={<div>REQUIREMENTS_STUB</div>} />
          </Routes>
        </CreateProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /やり直し/ })).toBeInTheDocument(),
    );
    // ロック表示では名称入力は出ない
    expect(screen.queryByLabelText('プロジェクト名')).toBeNull();
  });
});
