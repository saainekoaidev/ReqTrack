import { describe, it, expect } from 'vitest';
import {
  expectedProgress,
  detectDelay,
  delayedMembers,
  scheduleTasks,
  isWorkingDay,
  nextWorkingDay,
  toDateKey,
  type PlannedTask,
} from './schedule.js';

const base: PlannedTask = {
  id: 't1',
  name: 'task',
  assigneeId: 'm1',
  plannedStart: new Date('2026-06-01T00:00:00.000Z'),
  plannedEnd: new Date('2026-06-11T00:00:00.000Z'), // 10 日間
  progress: 0,
};

describe('expectedProgress', () => {
  it('開始前は 0', () => {
    expect(expectedProgress(base, new Date('2026-05-31T00:00:00.000Z'))).toBe(0);
  });

  it('終了後は 100', () => {
    expect(expectedProgress(base, new Date('2026-06-12T00:00:00.000Z'))).toBe(100);
  });

  it('中間地点(5日経過)は約 50', () => {
    expect(expectedProgress(base, new Date('2026-06-06T00:00:00.000Z'))).toBe(50);
  });

  it('計画日が無いと 0', () => {
    expect(expectedProgress({ ...base, plannedStart: null }, new Date())).toBe(0);
  });
});

describe('detectDelay', () => {
  it('実績が期待を下回ると遅延', () => {
    const r = detectDelay({ ...base, progress: 20 }, new Date('2026-06-06T00:00:00.000Z'));
    expect(r.expectedProgress).toBe(50);
    expect(r.actualProgress).toBe(20);
    expect(r.behindBy).toBe(30);
    expect(r.isDelayed).toBe(true);
  });

  it('実績が期待以上なら遅延でない', () => {
    const r = detectDelay({ ...base, progress: 60 }, new Date('2026-06-06T00:00:00.000Z'));
    expect(r.isDelayed).toBe(false);
  });
});

describe('isWorkingDay / nextWorkingDay', () => {
  const noHoliday = new Set<string>();
  it('土日は非稼働日', () => {
    expect(isWorkingDay(new Date('2026-06-06T00:00:00Z'), noHoliday)).toBe(false); // Sat
    expect(isWorkingDay(new Date('2026-06-07T00:00:00Z'), noHoliday)).toBe(false); // Sun
    expect(isWorkingDay(new Date('2026-06-08T00:00:00Z'), noHoliday)).toBe(true); // Mon
  });
  it('祝日は非稼働日', () => {
    const holidays = new Set(['2026-06-08']);
    expect(isWorkingDay(new Date('2026-06-08T00:00:00Z'), holidays)).toBe(false);
  });
  it('土曜の次の稼働日は月曜', () => {
    const d = nextWorkingDay(new Date('2026-06-06T00:00:00Z'), noHoliday);
    expect(toDateKey(d)).toBe('2026-06-08');
  });
});

describe('scheduleTasks', () => {
  it('見積を稼働日ベースで直列に割り付ける(週末をスキップ)', () => {
    const start = new Date('2026-06-08T00:00:00Z'); // Mon
    const result = scheduleTasks(
      [
        { id: 'a', estimateDays: 3 },
        { id: 'b', estimateDays: 2 },
        { id: 'c', estimateDays: 1 },
      ],
      start,
    );
    expect(result.map((r) => [r.id, toDateKey(r.plannedStart), toDateKey(r.plannedEnd)])).toEqual([
      ['a', '2026-06-08', '2026-06-10'], // Mon-Wed
      ['b', '2026-06-11', '2026-06-12'], // Thu-Fri
      ['c', '2026-06-15', '2026-06-15'], // 次の月曜
    ]);
  });

  it('祝日をスキップする', () => {
    const start = new Date('2026-06-08T00:00:00Z');
    const result = scheduleTasks([{ id: 'a', estimateDays: 2 }], start, new Set(['2026-06-09']));
    // Mon は稼働、Tue(09) は祝日 → Mon + Wed の 2 稼働日
    expect(toDateKey(result[0]!.plannedStart)).toBe('2026-06-08');
    expect(toDateKey(result[0]!.plannedEnd)).toBe('2026-06-10');
  });

  it('見積0でも最低1稼働日を割り当てる', () => {
    const result = scheduleTasks([{ id: 'a', estimateDays: 0 }], new Date('2026-06-08T00:00:00Z'));
    expect(toDateKey(result[0]!.plannedStart)).toBe('2026-06-08');
    expect(toDateKey(result[0]!.plannedEnd)).toBe('2026-06-08');
  });
});

describe('delayedMembers', () => {
  it('遅延タスクを担当者ごとに集約し遅れ量の降順で返す', () => {
    const now = new Date('2026-06-06T00:00:00.000Z'); // 期待 50
    const tasks: PlannedTask[] = [
      { ...base, id: 'a', assigneeId: 'm1', progress: 20 }, // behind 30
      { ...base, id: 'b', assigneeId: 'm1', progress: 40 }, // behind 10
      { ...base, id: 'c', assigneeId: 'm2', progress: 45 }, // behind 5
      { ...base, id: 'd', assigneeId: 'm3', progress: 80 }, // not delayed
      { ...base, id: 'e', assigneeId: null, progress: 0 }, // 担当者なしは無視
    ];
    const result = delayedMembers(tasks, now);
    expect(result).toEqual([
      { assigneeId: 'm1', totalBehind: 40, taskIds: ['a', 'b'] },
      { assigneeId: 'm2', totalBehind: 5, taskIds: ['c'] },
    ]);
  });
});
