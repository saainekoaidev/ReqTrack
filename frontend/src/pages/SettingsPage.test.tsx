import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';

describe('SettingsPage (US-022)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('タブを切り替えて要員・休日を登録できる', async () => {
    const createdMember = { id: 'm1', name: '山田 太郎', role: 'PL', email: null, createdAt: '' };
    const createdHoliday = { id: 'h1', date: '2026-01-01T00:00:00.000Z', name: '元日' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        let body: unknown = [];
        if (url.includes('/api/members') && init?.method === 'POST') body = createdMember;
        else if (url.includes('/api/holidays') && init?.method === 'POST') body = createdHoliday;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    // 既定は基本設定タブ
    expect(screen.getByText('見積スコープ')).toBeInTheDocument();

    // 要員タブ
    await userEvent.click(screen.getByRole('tab', { name: /要員/ }));
    await userEvent.type(screen.getByLabelText('要員氏名'), '山田 太郎');
    await userEvent.click(screen.getByRole('button', { name: '要員を登録' }));
    await waitFor(() => expect(screen.getByText(/山田 太郎/)).toBeInTheDocument());

    // 休日タブ
    await userEvent.click(screen.getByRole('tab', { name: /休日/ }));
    await userEvent.type(screen.getByLabelText('祝日の日付'), '2026-01-01');
    await userEvent.type(screen.getByLabelText('祝日の名称'), '元日');
    await userEvent.click(screen.getByRole('button', { name: '祝日を登録' }));
    await waitFor(() => expect(screen.getByText(/元日/)).toBeInTheDocument());
  });
});
