import { describe, it, expect } from 'vitest';
import { buildGantt, dayLabel, isWeekend, overallProgress } from './gantt';
import type { Task } from '../api/client';

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    projectId: 'p1',
    requirementId: null,
    name: partial.id,
    estimateDays: 0,
    utilizationRate: 1,
    plannedStart: null,
    plannedEnd: null,
    progress: 0,
    assigneeId: null,
    ...partial,
  };
}

describe('buildGantt', () => {
  it('計画日のあるタスクから日数軸とバー位置を計算する', () => {
    const tasks = [
      task({ id: 'a', plannedStart: '2026-06-08T00:00:00Z', plannedEnd: '2026-06-10T00:00:00Z' }),
      task({ id: 'b', plannedStart: '2026-06-11T00:00:00Z', plannedEnd: '2026-06-12T00:00:00Z' }),
    ];
    const { days, rows } = buildGantt(tasks);
    expect(days).toHaveLength(5); // 06-08 .. 06-12
    expect(rows[0]).toMatchObject({ startOffset: 0, duration: 3 });
    expect(rows[1]).toMatchObject({ startOffset: 3, duration: 2 });
  });

  it('計画日が無いタスクは除外する', () => {
    const { days, rows } = buildGantt([task({ id: 'x' })]);
    expect(days).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });
});

describe('overallProgress', () => {
  it('見積で加重平均する', () => {
    // (100*4 + 0*1) / 5 = 80
    const tasks = [
      task({ id: 'a', estimateDays: 4, progress: 100 }),
      task({ id: 'b', estimateDays: 1, progress: 0 }),
    ];
    expect(overallProgress(tasks)).toBe(80);
  });

  it('見積が全て0なら単純平均', () => {
    const tasks = [
      task({ id: 'a', estimateDays: 0, progress: 50 }),
      task({ id: 'b', estimateDays: 0, progress: 100 }),
    ];
    expect(overallProgress(tasks)).toBe(75);
  });

  it('タスクなしは0', () => {
    expect(overallProgress([])).toBe(0);
  });
});

describe('helpers', () => {
  it('dayLabel は M/D', () => {
    expect(dayLabel(new Date('2026-06-08T00:00:00Z'))).toBe('6/8');
  });
  it('isWeekend は土日のみ true', () => {
    expect(isWeekend(new Date('2026-06-06T00:00:00Z'))).toBe(true); // Sat
    expect(isWeekend(new Date('2026-06-08T00:00:00Z'))).toBe(false); // Mon
  });
});
