import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ManageLayout from './ManageLayout';

function mockProjects(projects: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.includes('/api/projects') ? projects : [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

function renderManage() {
  return render(
    <MemoryRouter initialEntries={['/manage/gantt']}>
      <Routes>
        <Route path="/manage" element={<ManageLayout />}>
          <Route path="gantt" element={<div>GANTT_CONTENT</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ManageLayout guard (US-032)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('ガント保有プロジェクトが無いと案内を表示し遷移不可', async () => {
    mockProjects([{ id: 'p1', name: '案件A', description: null, createdAt: '', hasSchedule: false }]);
    renderManage();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '表示できるガントがありません' })).toBeInTheDocument(),
    );
    expect(screen.queryByText('GANTT_CONTENT')).not.toBeInTheDocument();
  });

  it('ガント保有プロジェクトがあればシェルとメニューを表示', async () => {
    mockProjects([{ id: 'p1', name: '案件A', description: null, createdAt: '', hasSchedule: true }]);
    renderManage();
    await waitFor(() => expect(screen.getByText('GANTT_CONTENT')).toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: '進捗管理メニュー' })).toBeInTheDocument();
  });
});
