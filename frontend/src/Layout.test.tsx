import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import Layout from './Layout';
import HomePage from './pages/HomePage';

describe('Layout', () => {
  it('ヘッダとナビを表示し、ホームを描画する', () => {
    const router = createMemoryRouter(
      [{ path: '/', element: <Layout />, children: [{ index: true, element: <HomePage /> }] }],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('heading', { name: 'ReqTrack' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'メインナビゲーション' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ダッシュボード' })).toBeInTheDocument();
  });
});
