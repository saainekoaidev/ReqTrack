import { describe, it, expect } from 'vitest';
import {
  buildGantt,
  dayLabel,
  isWeekend,
  overallProgress,
  monthSpans,
  phaseColor,
  weekdayJa,
  workloadByAssignee,
} from './gantt';
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
    level: 3,
    wbsId: null,
    parentId: null,
    phase: null,
    estimateNote: null,
    kind: 'task',
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

describe('US-015 helpers', () => {
  it('monthSpans は連続日を月ごとにまとめる', () => {
    const days = [
      new Date('2026-06-29T00:00:00Z'),
      new Date('2026-06-30T00:00:00Z'),
      new Date('2026-07-01T00:00:00Z'),
    ];
    expect(monthSpans(days)).toEqual([
      { label: '2026/6', span: 2 },
      { label: '2026/7', span: 1 },
    ]);
  });

  it('phaseColor は工程ごとに色を返し、未該当は既定色', () => {
    expect(phaseColor('基本設計')).toBe('#a5d8ff');
    expect(phaseColor('基本設計レビュー')).toBe('#fff3bf'); // レビュー優先
    expect(phaseColor(null)).toBe('#ced4da');
  });

  it('weekdayJa は日本語曜日', () => {
    expect(weekdayJa(new Date('2026-06-08T00:00:00Z'))).toBe('月');
  });

  it('workloadByAssignee は担当者別に集計し効率化を除外、単価から工賃も算出', () => {
    const yamada = { id: 'm1', name: '山田', role: null, email: null, hourlyRate: 1000, createdAt: '' };
    const result = workloadByAssignee(
      [
        task({ id: 'a', estimateDays: 2, assignee: yamada }),
        task({ id: 'b', estimateDays: 1, assignee: yamada }),
        task({ id: 'c', estimateDays: -1, kind: 'efficiency' }),
        task({ id: 'd', estimateDays: 0.5 }), // 未割当
      ],
      8,
    );
    expect(result).toEqual([
      { name: '山田', days: 3, cost: 24000 }, // 3人日 × 8h × 1000円
      { name: '(未割当)', days: 0.5, cost: null },
    ]);
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
