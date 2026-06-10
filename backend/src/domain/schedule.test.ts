import { describe, it, expect } from 'vitest';
import {
  expectedProgress,
  detectDelay,
  delayedMembers,
  scheduleTasks,
  workingDaysNeeded,
  normalizeUtilization,
  isWorkingDay,
  nextWorkingDay,
  toDateKey,
  buildRecoveryPlan,
  type PlannedTask,
  type RecoveryTask,
} from './schedule.js';

// 時刻まで含めて比較するためのヘルパ(UTC, 例: 2026-06-08T09:00)
function key(d: Date): string {
  return d.toISOString().slice(0, 16);
}

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

describe('workingDaysNeeded / normalizeUtilization (US-012 / US-040 稼働率・小数日)', () => {
  it('稼働日数 = 工数 ÷ 稼働率(切り上げない)', () => {
    expect(workingDaysNeeded(3, 1)).toBe(3); // 専従3人日 → 3.0営業日
    expect(workingDaysNeeded(0.6, 0.2)).toBeCloseTo(3, 9); // 20% → 3.0
    expect(workingDaysNeeded(3, 0.75)).toBe(4); // 2.25日相当 → 4.0
    expect(workingDaysNeeded(0.5, 1)).toBe(0.5); // 小数はそのまま
    expect(workingDaysNeeded(0, 1)).toBe(0);
  });
  it('稼働率は 0<r<=1 に正規化', () => {
    expect(normalizeUtilization(undefined)).toBe(1);
    expect(normalizeUtilization(0)).toBe(1);
    expect(normalizeUtilization(2)).toBe(1);
    expect(normalizeUtilization(0.5)).toBe(0.5);
  });
});

describe('scheduleTasks (小数日・連続割付, US-040)', () => {
  it('稼働率20%のタスク(0.6人日)は3稼働日ぴったり(始業〜終業)', () => {
    const start = new Date('2026-06-08T00:00:00Z'); // Mon
    const r = scheduleTasks([{ id: 'a', estimateDays: 0.6, utilizationRate: 0.2 }], start, new Set(), 8);
    expect(key(r[0]!.plannedStart)).toBe('2026-06-08T09:00'); // Mon 始業
    expect(key(r[0]!.plannedEnd)).toBe('2026-06-10T17:00'); // Wed 終業(3稼働日=24h)
  });

  it('0.5人日は半日(始業9:00〜13:00)に割り付け、次タスクは13:00から連続', () => {
    const start = new Date('2026-06-08T00:00:00Z'); // Mon, 8h/日
    const r = scheduleTasks(
      [
        { id: 'a', estimateDays: 0.5 },
        { id: 'b', estimateDays: 0.25 },
      ],
      start,
      new Set(),
      8,
    );
    expect(key(r[0]!.plannedStart)).toBe('2026-06-08T09:00');
    expect(key(r[0]!.plannedEnd)).toBe('2026-06-08T13:00'); // 4h
    expect(key(r[1]!.plannedStart)).toBe('2026-06-08T13:00'); // 連続(コマ無し)
    expect(key(r[1]!.plannedEnd)).toBe('2026-06-08T15:00'); // +2h
  });

  it('整数日タスクは始業〜終業で直列・週末をスキップ', () => {
    const start = new Date('2026-06-08T00:00:00Z'); // Mon
    const r = scheduleTasks(
      [
        { id: 'a', estimateDays: 3 },
        { id: 'b', estimateDays: 2 },
        { id: 'c', estimateDays: 1 },
      ],
      start,
      new Set(),
      8,
    );
    expect(r.map((x) => [x.id, key(x.plannedStart), key(x.plannedEnd)])).toEqual([
      ['a', '2026-06-08T09:00', '2026-06-10T17:00'], // Mon-Wed
      ['b', '2026-06-11T09:00', '2026-06-12T17:00'], // Thu-Fri
      ['c', '2026-06-15T09:00', '2026-06-15T17:00'], // 次の月曜
    ]);
  });

  it('祝日をスキップする', () => {
    const start = new Date('2026-06-08T00:00:00Z');
    const r = scheduleTasks([{ id: 'a', estimateDays: 2 }], start, new Set(['2026-06-09']), 8);
    // Mon 稼働、Tue(09)祝日 → Mon + Wed
    expect(key(r[0]!.plannedStart)).toBe('2026-06-08T09:00');
    expect(key(r[0]!.plannedEnd)).toBe('2026-06-10T17:00');
  });

  it('日内に収まらない端数は翌稼働日へ繰り越す(1.5人日)', () => {
    const start = new Date('2026-06-08T00:00:00Z'); // Mon
    const r = scheduleTasks([{ id: 'a', estimateDays: 1.5 }], start, new Set(), 8);
    expect(key(r[0]!.plannedStart)).toBe('2026-06-08T09:00');
    expect(key(r[0]!.plannedEnd)).toBe('2026-06-09T13:00'); // 8h + 4h
  });
});

describe('scheduleTasks (要員・依存, US-041)', () => {
  const start = new Date('2026-06-08T00:00:00Z'); // Mon

  it('別要員のタスクは並行(同時開始)する', () => {
    const r = scheduleTasks(
      [
        { id: 'a', estimateDays: 1, resourceKey: 'm1' },
        { id: 'b', estimateDays: 1, resourceKey: 'm2' },
      ],
      start,
      new Set(),
      8,
    );
    expect(key(r[0]!.plannedStart)).toBe('2026-06-08T09:00');
    expect(key(r[1]!.plannedStart)).toBe('2026-06-08T09:00'); // 並行
  });

  it('同一要員のタスクは直列(1人が同時に複数不可)', () => {
    const r = scheduleTasks(
      [
        { id: 'a', estimateDays: 1, resourceKey: 'm1' },
        { id: 'b', estimateDays: 1, resourceKey: 'm1' },
      ],
      start,
      new Set(),
      8,
    );
    expect(key(r[0]!.plannedEnd)).toBe('2026-06-08T17:00');
    expect(key(r[1]!.plannedStart)).toBe('2026-06-09T09:00'); // 直列
  });

  it('同一対象(groupKey)配下は別要員でも工程順に直列(依存)', () => {
    const r = scheduleTasks(
      [
        { id: 'design', estimateDays: 1, groupKey: 'tgt1', resourceKey: 'm1' },
        { id: 'code', estimateDays: 1, groupKey: 'tgt1', resourceKey: 'm2' },
      ],
      start,
      new Set(),
      8,
    );
    // 別要員でも同一対象配下なので design 完了後に code 開始
    expect(key(r[0]!.plannedEnd)).toBe('2026-06-08T17:00');
    expect(key(r[1]!.plannedStart)).toBe('2026-06-09T09:00');
  });

  it('別対象のタスクは並行できる(依存なし・別要員)', () => {
    const r = scheduleTasks(
      [
        { id: 'a', estimateDays: 1, groupKey: 'tgtA', resourceKey: 'm1' },
        { id: 'b', estimateDays: 1, groupKey: 'tgtB', resourceKey: 'm2' },
      ],
      start,
      new Set(),
      8,
    );
    expect(key(r[0]!.plannedStart)).toBe('2026-06-08T09:00');
    expect(key(r[1]!.plannedStart)).toBe('2026-06-08T09:00');
  });
});

describe('scheduleTasks (進捗のあるタスクの固定, US-042)', () => {
  const start = new Date('2026-06-15T00:00:00Z'); // 再生成の開始日(月)

  it('完了(100%)タスクは開始日を変えても元の計画日を固定する', () => {
    const r = scheduleTasks(
      [
        {
          id: 'done',
          estimateDays: 1,
          progress: 100,
          fixedStart: new Date('2026-06-08T09:00:00Z'),
          fixedEnd: new Date('2026-06-08T17:00:00Z'),
        },
      ],
      start,
      new Set(),
      8,
    );
    expect(key(r[0]!.plannedStart)).toBe('2026-06-08T09:00');
    expect(key(r[0]!.plannedEnd)).toBe('2026-06-08T17:00');
  });

  it('着手中(50%)は開始固定で、工数増は終了を伸ばす', () => {
    const r = scheduleTasks(
      [
        {
          id: 'wip',
          estimateDays: 2, // 元1人日→2人日に増やした想定
          progress: 50,
          fixedStart: new Date('2026-06-08T09:00:00Z'),
          fixedEnd: new Date('2026-06-08T17:00:00Z'),
        },
      ],
      start,
      new Set(),
      8,
    );
    expect(key(r[0]!.plannedStart)).toBe('2026-06-08T09:00'); // 開始は固定
    expect(key(r[0]!.plannedEnd)).toBe('2026-06-09T17:00'); // 2人日に伸長
  });

  it('着手中タスクの後続(未着手)はアンカー終了後から流れる(前段挿入で押し戻さない)', () => {
    const r = scheduleTasks(
      [
        // 同一対象内: 着手中の作業(アンカー) → 未着手の前段挿入/後続
        {
          id: 'wip',
          estimateDays: 1,
          groupKey: 'tgt',
          progress: 30,
          fixedStart: new Date('2026-06-08T09:00:00Z'),
          fixedEnd: new Date('2026-06-08T17:00:00Z'),
        },
        { id: 'next', estimateDays: 1, groupKey: 'tgt', progress: 0 },
      ],
      start,
      new Set(),
      8,
    );
    expect(key(r[0]!.plannedStart)).toBe('2026-06-08T09:00'); // 着手中は固定
    // 後続は「アンカー終了」と「開始日」の遅い方から → 開始日(06-15)起点
    expect(key(r[1]!.plannedStart)).toBe('2026-06-15T09:00');
  });

  it('進捗0%は固定せず開始日から引き直す', () => {
    const start0 = new Date('2026-06-15T00:00:00Z');
    const r = scheduleTasks(
      [
        {
          id: 'a',
          estimateDays: 1,
          progress: 0,
          fixedStart: new Date('2026-06-08T09:00:00Z'),
          fixedEnd: new Date('2026-06-08T17:00:00Z'),
        },
      ],
      start0,
      new Set(),
      8,
    );
    expect(key(r[0]!.plannedStart)).toBe('2026-06-15T09:00'); // 開始日へ
  });
});

describe('scheduleTasks (明示的な前提タスク, US-050)', () => {
  const start = new Date('2026-06-08T00:00:00Z'); // Mon

  it('2.3 の前提が 1.1 のとき、別要員でも 1.1 の終了後に開始する', () => {
    const r = scheduleTasks(
      [
        { id: 't11', estimateDays: 2, groupKey: 'g1', resourceKey: 'm1' }, // 1.1: Mon-Tue
        { id: 't23', estimateDays: 1, groupKey: 'g2', resourceKey: 'm2', predecessors: ['t11'] }, // 2.3
      ],
      start,
      new Set(),
      8,
    );
    const by = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(key(by['t11']!.plannedEnd)).toBe('2026-06-09T17:00'); // Tue 終業
    expect(key(by['t23']!.plannedStart)).toBe('2026-06-10T09:00'); // Wed 始業(前提の後)
  });

  it('前提が後ろに並んでいてもトポロジカル順で正しく後続を配置する', () => {
    const r = scheduleTasks(
      [
        // 配列順では後続が先に来るが、前提を尊重する
        { id: 'b', estimateDays: 1, groupKey: 'g2', resourceKey: 'm2', predecessors: ['a'] },
        { id: 'a', estimateDays: 1, groupKey: 'g1', resourceKey: 'm1' },
      ],
      start,
      new Set(),
      8,
    );
    const by = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(key(by['a']!.plannedEnd)).toBe('2026-06-08T17:00');
    expect(key(by['b']!.plannedStart)).toBe('2026-06-09T09:00');
  });
});

describe('scheduleTasks (対面/書面レビューの同期配置, US-047)', () => {
  it('対面レビュー(syncGroup)は双方の空きが合う最早区間へ同時配置する', () => {
    const start = new Date('2026-06-08T00:00:00Z'); // Mon
    const r = scheduleTasks(
      [
        // m1(レビュワー) は Mon-Tue 埋まっている別作業
        { id: 'm1dev', estimateDays: 2, groupKey: 'gx', resourceKey: 'm1' },
        // m2(レビュイー) は Mon の開発
        { id: 'm2dev', estimateDays: 1, groupKey: 'g1', resourceKey: 'm2' },
        // 対面レビュー: m1 と m2 の同期ペア(g1 配下、m2dev の後)
        { id: 'rev1', estimateDays: 1, groupKey: 'g1', resourceKey: 'm1', syncGroup: 'L1' },
        { id: 'rev2', estimateDays: 1, groupKey: 'g1', resourceKey: 'm2', syncGroup: 'L1' },
      ],
      start,
      new Set(),
      8,
    );
    const by = Object.fromEntries(r.map((x) => [x.id, x]));
    // m1 は Mon-Tue 埋まり → 双方空くのは Wed。レビューは Wed 同時刻。
    expect(key(by['rev1']!.plannedStart)).toBe('2026-06-10T09:00');
    expect(key(by['rev2']!.plannedStart)).toBe('2026-06-10T09:00');
    expect(by['rev1']!.plannedEnd.getTime()).toBe(by['rev2']!.plannedEnd.getTime());
  });

  it('レビュイーは待っている間に別タスクを進められる(空きが前詰めされる)', () => {
    const start = new Date('2026-06-08T00:00:00Z');
    const r = scheduleTasks(
      [
        { id: 'm1busy', estimateDays: 3, groupKey: 'gx', resourceKey: 'm1' }, // Mon-Wed
        { id: 'm2dev', estimateDays: 1, groupKey: 'g1', resourceKey: 'm2' }, // Mon
        { id: 'rev1', estimateDays: 1, groupKey: 'g1', resourceKey: 'm1', syncGroup: 'L1' },
        { id: 'rev2', estimateDays: 1, groupKey: 'g1', resourceKey: 'm2', syncGroup: 'L1' },
        { id: 'm2other', estimateDays: 1, groupKey: 'g2', resourceKey: 'm2' }, // 別対象の作業
      ],
      start,
      new Set(),
      8,
    );
    const by = Object.fromEntries(r.map((x) => [x.id, x]));
    // m2other は m2 の空き(Tue)に前詰めされ、レビュー(Thu, m1 が Wed まで埋まる)を待たない
    expect(key(by['m2other']!.plannedStart)).toBe('2026-06-09T09:00'); // Tue
    expect(key(by['rev1']!.plannedStart)).toBe('2026-06-11T09:00'); // Thu(m1 Mon-Wed)
  });
});

describe('buildRecoveryPlan', () => {
  const now = new Date('2026-06-06T00:00:00Z'); // 10日タスクの中間 → 期待50%
  const baseTask: RecoveryTask = {
    id: 't',
    name: 'task',
    estimateDays: 10,
    assigneeName: '山田',
    plannedStart: new Date('2026-06-01T00:00:00Z'),
    plannedEnd: new Date('2026-06-11T00:00:00Z'),
    progress: 0,
  };

  it('遅延タスクのみを対象に挽回策を提示し、遅れ量降順に並べる', () => {
    const plan = buildRecoveryPlan(
      [
        { ...baseTask, id: 'a', name: '軽微', progress: 45 }, // behind 5 → low
        { ...baseTask, id: 'b', name: '重度', progress: 0 }, // behind 50 → high
        { ...baseTask, id: 'c', name: '順調', progress: 60 }, // not delayed
      ],
      now,
    );
    expect(plan.delayedCount).toBe(2);
    expect(plan.actions.map((a) => a.taskId)).toEqual(['b', 'a']); // behind 降順
    expect(plan.actions[0]!.severity).toBe('high');
    expect(plan.actions[1]!.severity).toBe('low');
  });

  it('担当未割当なら割当を促す', () => {
    const plan = buildRecoveryPlan(
      [{ ...baseTask, assigneeName: null, progress: 0 }],
      now,
    );
    expect(plan.actions[0]!.suggestions.some((s) => s.includes('担当者が未割当'))).toBe(true);
  });

  it('残作業(人日)を見積×残進捗で概算する', () => {
    // estimate 10, actual 20% → remaining 8 人日
    const plan = buildRecoveryPlan([{ ...baseTask, progress: 20 }], now);
    expect(plan.actions[0]!.remainingDays).toBe(8);
    expect(plan.totalRemainingDays).toBe(8);
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
