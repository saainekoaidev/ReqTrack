import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateStepper } from './CreateStepper';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CreateStepper />
    </MemoryRouter>,
  );
}

describe('CreateStepper (US-023)', () => {
  it('現在のルートに対応するステップを is-active にする', () => {
    renderAt('/create/estimate');
    const active = document.querySelector('.step.is-active');
    expect(active?.textContent).toContain('見積');
  });

  it('要件・タスク系のパスでは該当ステップが active', () => {
    renderAt('/create/wbs');
    const active = document.querySelector('.step.is-active');
    expect(active?.textContent).toContain('要件・タスク');
  });

  it('全ステップを表示する', () => {
    renderAt('/create');
    expect(screen.getByText(/プロジェクト作成/)).toBeInTheDocument();
    expect(screen.getByText(/ガント/)).toBeInTheDocument();
  });
});
