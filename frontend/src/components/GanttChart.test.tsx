import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GanttChart from './GanttChart';
import type { Task } from '../api/client';

function task(p: Partial<Task> & { id: string }): Task {
  return {
    projectId: 'p1',
    requirementId: null,
    name: p.id,
    estimateDays: 0,
    utilizationRate: 1,
    plannedStart: null,
    plannedEnd: null,
    progress: 0,
    assigneeId: null,
    ...p,
  };
}

describe('GanttChart (US-008 進捗反映)', () => {
  it('進捗率がバーの塗り幅に反映される', () => {
    render(
      <GanttChart
        tasks={[
          task({
            id: 't1',
            name: '設計',
            progress: 40,
            plannedStart: '2026-06-08T00:00:00Z',
            plannedEnd: '2026-06-10T00:00:00Z',
          }),
        ]}
      />,
    );
    const fill = screen.getByTestId('progress-t1');
    expect(fill).toHaveStyle({ width: '40%' });
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('計画日が無ければ案内を表示', () => {
    render(<GanttChart tasks={[task({ id: 'x' })]} />);
    expect(screen.getByText(/計画日が設定されたタスクがありません/)).toBeInTheDocument();
  });
});
