import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    level: 3,
    wbsId: null,
    parentId: null,
    phase: null,
    estimateNote: null,
    kind: 'task',
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
    // 進捗列とバーラベルの両方に 40% が出る (US-048)
    expect(screen.getAllByText('40%').length).toBeGreaterThanOrEqual(1);
  });

  it('計画日が無ければ案内を表示', () => {
    render(<GanttChart tasks={[task({ id: 'x' })]} />);
    expect(screen.getByText(/計画日が設定されたタスクがありません/)).toBeInTheDocument();
  });

  it('onPatch 指定時は葉行の工数をインライン編集して保存する (US-046)', async () => {
    const onPatch = vi.fn();
    render(
      <GanttChart
        tasks={[
          task({
            id: 't1',
            wbsId: '1.1.1',
            name: '設計',
            estimateDays: 2,
            plannedStart: '2026-06-08T09:00:00Z',
            plannedEnd: '2026-06-09T17:00:00Z',
          }),
        ]}
        members={[]}
        onPatch={onPatch}
      />,
    );
    const input = screen.getByLabelText('1.1.1 の工数');
    await userEvent.clear(input);
    await userEvent.type(input, '5');
    input.blur();
    expect(onPatch).toHaveBeenCalledWith('t1', { estimateDays: 5 });
  });

  it('進捗率をガント上でインライン編集して保存する (US-053)', async () => {
    const onPatch = vi.fn();
    render(
      <GanttChart
        tasks={[
          task({
            id: 't1',
            wbsId: '1.1.1',
            name: '設計',
            progress: 0,
            plannedStart: '2026-06-08T09:00:00Z',
            plannedEnd: '2026-06-09T17:00:00Z',
          }),
        ]}
        members={[]}
        onPatch={onPatch}
      />,
    );
    const input = screen.getByLabelText('1.1.1 の進捗率');
    await userEvent.clear(input);
    await userEvent.type(input, '50');
    expect(onPatch).toHaveBeenCalledWith('t1', { progress: 50 });
  });
});
