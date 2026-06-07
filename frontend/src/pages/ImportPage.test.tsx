import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ImportPage from './ImportPage';

const project = { id: 'p1', name: '案件A', description: null, createdAt: '' };

describe('ImportPage (US-019)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('自然文を取り込むと結果メッセージを表示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        let body: unknown = [];
        if (url.includes('/import/requirements-text')) body = { requirements: 2, tasks: 10 };
        else if (url.includes('/api/projects')) body = [project];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    render(
      <MemoryRouter>
        <ImportPage />
      </MemoryRouter>,
    );

    const ta = await screen.findByLabelText('要件テキスト');
    await userEvent.type(ta, 'ログイン機能\n帳票出力');
    await userEvent.click(screen.getByRole('button', { name: 'テキストを取込' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('要件 2 件'));
  });
});
