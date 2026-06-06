import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MastersPage from './MastersPage';

describe('MastersPage (要員)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('要員を登録すると一覧に追加される', async () => {
    const created = { id: 'm1', name: '山田 太郎', role: 'SE', email: null, createdAt: '' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/members') && init?.method === 'POST') body = created;
        else if (url.includes('/api/members')) body = [];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    render(
      <MemoryRouter>
        <MastersPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('要員氏名'), '山田 太郎');
    await userEvent.type(screen.getByLabelText('役割'), 'SE');
    await userEvent.click(screen.getByRole('button', { name: '要員を登録' }));

    await waitFor(() => expect(screen.getByText(/山田 太郎/)).toBeInTheDocument());
  });
});
