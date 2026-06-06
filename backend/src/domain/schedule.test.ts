import { describe, it, expect } from 'vitest';
import { expectedProgress, detectDelay, delayedMembers, type PlannedTask } from './schedule.js';

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
