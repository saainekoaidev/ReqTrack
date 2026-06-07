import { describe, it, expect } from 'vitest';
import { naturalWbsCompare, sortTasksByWbs, nextFeatureWbsId, nextChildWbsId } from './wbs';
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

describe('wbs helpers (US-018)', () => {
  it('naturalWbsCompare は自然順', () => {
    const arr = ['10', '2', '1.10', '1.2', '1'];
    arr.sort(naturalWbsCompare);
    expect(arr).toEqual(['1', '1.2', '1.10', '2', '10']);
  });

  it('nextFeatureWbsId は level1 数+1', () => {
    expect(nextFeatureWbsId([task({ id: 'a', level: 1, wbsId: '1' })])).toBe('2');
    expect(nextFeatureWbsId([])).toBe('1');
  });

  it('nextChildWbsId は 親.兄弟+1', () => {
    const parent = task({ id: 'f', level: 1, wbsId: '1' });
    const tasks = [parent, task({ id: 'c1', level: 3, wbsId: '1.1', parentId: 'f' })];
    expect(nextChildWbsId(parent, tasks)).toBe('1.2');
  });

  it('sortTasksByWbs で機能→子の順に並ぶ', () => {
    const tasks = [
      task({ id: 'c', wbsId: '1.2' }),
      task({ id: 'a', wbsId: '1', level: 1 }),
      task({ id: 'b', wbsId: '1.1' }),
    ];
    expect(sortTasksByWbs(tasks).map((t) => t.wbsId)).toEqual(['1', '1.1', '1.2']);
  });
});
