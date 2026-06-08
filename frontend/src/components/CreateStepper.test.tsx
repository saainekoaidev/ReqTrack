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

describe('CreateStepper (US-023 / US-038)', () => {
  it('現在のルートに対応するステップを is-active にする', () => {
    renderAt('/create/estimate');
    const active = document.querySelector('.step.is-active');
    expect(active?.textContent).toContain('見積・ガント');
  });

  it('要件登録のパスでは該当ステップが active', () => {
    renderAt('/create/requirements');
    const active = document.querySelector('.step.is-active');
    expect(active?.textContent).toContain('要件登録');
  });

  it('手組み(/create/wbs)は見積・ガントステップ扱い', () => {
    renderAt('/create/wbs');
    const active = document.querySelector('.step.is-active');
    expect(active?.textContent).toContain('見積・ガント');
  });

  it('全3ステップを表示する', () => {
    renderAt('/create');
    expect(screen.getByText(/プロジェクト作成/)).toBeInTheDocument();
    expect(screen.getByText(/要件登録/)).toBeInTheDocument();
    expect(screen.getByText(/見積・ガント/)).toBeInTheDocument();
  });
});
