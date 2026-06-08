import { describe, it, expect } from 'vitest';
import {
  buildGantt,
  fmtDateYmd,
  isWeekend,
  overallProgress,
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

describe('buildGantt (US-040 稼働時間軸)', () => {
  it('計画日のあるタスクから稼働日軸とバー位置(小数)を計算する', () => {
    const tasks = [
      task({ id: 'a', wbsId: '1', plannedStart: '2026-06-08T09:00:00Z', plannedEnd: '2026-06-10T17:00:00Z' }),
      task({ id: 'b', wbsId: '2', plannedStart: '2026-06-11T09:00:00Z', plannedEnd: '2026-06-12T17:00:00Z' }),
    ];
    const { axis, rows, totalWT, months } = buildGantt(tasks, new Set(), 8);
    expect(axis).toHaveLength(5); // 06-08..06-12 の平日
    expect(totalWT).toBe(5);
    expect(rows[0]).toMatchObject({ startWT: 0, endWT: 3 }); // 3稼働日
    expect(rows[1]).toMatchObject({ startWT: 3, endWT: 5 });
    expect(months).toEqual([{ label: '2026年6月', span: 5 }]);
  });

  it('半日(0.5人日)のバーは幅0.5稼働日になる', () => {
    const tasks = [
      task({ id: 'a', wbsId: '1', plannedStart: '2026-06-08T09:00:00Z', plannedEnd: '2026-06-08T13:00:00Z' }),
    ];
    const { rows } = buildGantt(tasks, new Set(), 8);
    expect(rows[0]!.startWT).toBe(0);
    expect(rows[0]!.endWT).toBeCloseTo(0.5, 6);
  });

  it('親(機能/対象)行は配下の葉から開始/終了/工数を集計し、深さと折り畳み情報を持つ', () => {
    const tasks = [
      task({ id: 'F', level: 1, wbsId: '1', name: '機能' }),
      task({ id: 'T', level: 2, wbsId: '1.1', name: '画面', parentId: 'F' }),
      task({
        id: 'L',
        level: 3,
        wbsId: '1.1.1',
        name: '設計',
        parentId: 'T',
        estimateDays: 2,
        plannedStart: '2026-06-08T09:00:00Z',
        plannedEnd: '2026-06-09T17:00:00Z',
      }),
    ];
    const { rows } = buildGantt(tasks, new Set(), 8);
    expect(rows.map((r) => r.task.id)).toEqual(['F', 'T', 'L']);
    expect(rows[0]).toMatchObject({ depth: 0, hasChildren: true, totalDays: 2 });
    expect(rows[2]).toMatchObject({ depth: 2, hasChildren: false });
    expect(rows[2]!.ancestorIds).toEqual(['T', 'F']);
    // 親の開始位置は葉と一致
    expect(rows[0]!.startWT).toBe(rows[2]!.startWT);
  });

  it('計画日が無いタスクは軸/行が空', () => {
    const { axis, rows } = buildGantt([task({ id: 'x' })]);
    expect(axis).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });
});

describe('overallProgress', () => {
  it('葉タスクを見積で加重平均する', () => {
    const tasks = [
      task({ id: 'a', estimateDays: 4, progress: 100 }),
      task({ id: 'b', estimateDays: 1, progress: 0 }),
    ];
    expect(overallProgress(tasks)).toBe(80);
  });

  it('親(子持ち)は集計から除外する', () => {
    const tasks = [
      task({ id: 'F', level: 1, estimateDays: 0, progress: 0 }),
      task({ id: 'a', parentId: 'F', estimateDays: 4, progress: 100 }),
      task({ id: 'b', parentId: 'F', estimateDays: 1, progress: 0 }),
    ];
    expect(overallProgress(tasks)).toBe(80);
  });

  it('タスクなしは0', () => {
    expect(overallProgress([])).toBe(0);
  });
});

describe('helpers (US-040)', () => {
  it('phaseColor は工程ごとに色を返し、未該当は既定色', () => {
    expect(phaseColor('基本設計')).toBe('#a5d8ff');
    expect(phaseColor('基本設計レビュー')).toBe('#fff3bf'); // レビュー優先
    expect(phaseColor(null)).toBe('#ced4da');
  });

  it('weekdayJa は日本語曜日', () => {
    expect(weekdayJa(new Date('2026-06-08T00:00:00Z'))).toBe('月');
  });

  it('fmtDateYmd は年込み(YYYY/M/D)', () => {
    expect(fmtDateYmd('2026-06-08T00:00:00Z')).toBe('2026/6/8');
    expect(fmtDateYmd(null)).toBe('');
  });

  it('isWeekend は土日のみ true', () => {
    expect(isWeekend(new Date('2026-06-06T00:00:00Z'))).toBe(true); // Sat
    expect(isWeekend(new Date('2026-06-08T00:00:00Z'))).toBe(false); // Mon
  });

  it('workloadByAssignee は担当者別に集計し効率化と親行を除外、単価から工賃も算出', () => {
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
      { name: '山田', days: 3, cost: 24000 },
      { name: '(未割当)', days: 0.5, cost: null },
    ]);
  });
});
