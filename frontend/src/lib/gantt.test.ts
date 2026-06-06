import { describe, it, expect } from 'vitest';
import { buildGantt, dayLabel, isWeekend } from './gantt';
import type { Task } from '../api/client';

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    projectId: 'p1',
    requirementId: null,
    name: partial.id,
    estimateDays: 0,
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

describe('helpers', () => {
  it('dayLabel は M/D', () => {
    expect(dayLabel(new Date('2026-06-08T00:00:00Z'))).toBe('6/8');
  });
  it('isWeekend は土日のみ true', () => {
    expect(isWeekend(new Date('2026-06-06T00:00:00Z'))).toBe(true); // Sat
    expect(isWeekend(new Date('2026-06-08T00:00:00Z'))).toBe(false); // Mon
  });
});
