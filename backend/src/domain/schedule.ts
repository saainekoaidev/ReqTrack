// スケジュール/遅延に関する純粋関数。DB に依存しないためユニットテストしやすい。
// US-009 (遅れ検出) / US-010 (遅れ要員の洗い出し) / US-011 (リカバリプラン) の中核ロジック。

export interface PlannedTask {
  id: string;
  name: string;
  assigneeId: string | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  /** 実績進捗率 0-100 */
  progress: number;
}

export interface DelayResult {
  taskId: string;
  /** 期待進捗率(計画上、本日時点であるべき進捗率) 0-100 */
  expectedProgress: number;
  /** 実績進捗率 0-100 */
  actualProgress: number;
  /** 遅れ量(期待 - 実績、正なら遅延) */
  behindBy: number;
  isDelayed: boolean;
}

/**
 * 計画期間に対する本日時点の期待進捗率を線形補間で算出する (US-009)。
 * - 開始前: 0
 * - 終了後: 100
 * - 期間中: 経過割合
 */
export function expectedProgress(task: PlannedTask, now: Date): number {
  const { plannedStart, plannedEnd } = task;
  if (!plannedStart || !plannedEnd) return 0;
  const start = plannedStart.getTime();
  const end = plannedEnd.getTime();
  const t = now.getTime();
  if (end <= start) return t >= end ? 100 : 0;
  if (t <= start) return 0;
  if (t >= end) return 100;
  return Math.round(((t - start) / (end - start)) * 100);
}

/**
 * タスクが計画に対して遅れているか判定する (US-009)。
 * @param thresholdPct 遅延とみなす最小の遅れ量(%)。既定 0。
 */
export function detectDelay(task: PlannedTask, now: Date, thresholdPct = 0): DelayResult {
  const expected = expectedProgress(task, now);
  const actual = clampPercent(task.progress);
  const behindBy = expected - actual;
  return {
    taskId: task.id,
    expectedProgress: expected,
    actualProgress: actual,
    behindBy,
    isDelayed: behindBy > thresholdPct,
  };
}

/**
 * 遅れている要員を洗い出す (US-010)。遅延タスクを担当者ごとに集約し、遅れ量の合計が大きい順に返す。
 */
export function delayedMembers(
  tasks: PlannedTask[],
  now: Date,
  thresholdPct = 0,
): { assigneeId: string; totalBehind: number; taskIds: string[] }[] {
  const byMember = new Map<string, { totalBehind: number; taskIds: string[] }>();
  for (const task of tasks) {
    if (!task.assigneeId) continue;
    const result = detectDelay(task, now, thresholdPct);
    if (!result.isDelayed) continue;
    const entry = byMember.get(task.assigneeId) ?? { totalBehind: 0, taskIds: [] };
    entry.totalBehind += result.behindBy;
    entry.taskIds.push(task.id);
    byMember.set(task.assigneeId, entry);
  }
  return [...byMember.entries()]
    .map(([assigneeId, v]) => ({ assigneeId, ...v }))
    .sort((a, b) => b.totalBehind - a.totalBehind);
}

function clampPercent(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

// ---- ガント初版のスケジューリング (US-004) ----

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD (UTC) 文字列に変換する。 */
export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 稼働日か判定する(土日でなく、祝日集合に含まれない)。 */
export function isWorkingDay(d: Date, holidays: ReadonlySet<string>): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false; // 日(0)・土(6)
  return !holidays.has(toDateKey(d));
}

/** date 以降(当日含む)で最初の稼働日を返す。 */
export function nextWorkingDay(date: Date, holidays: ReadonlySet<string>): Date {
  const d = new Date(date.getTime());
  while (!isWorkingDay(d, holidays)) {
    d.setTime(d.getTime() + DAY_MS);
  }
  return d;
}

export interface EstimatedTask {
  id: string;
  estimateDays: number;
}

export interface ScheduledTask {
  id: string;
  plannedStart: Date;
  plannedEnd: Date;
}

/**
 * 見積(人日)からタスクを直列にスケジューリングする (US-004 ガント初版)。
 * - 稼働日(土日・祝日を除く)のみカウント
 * - 各タスクの所要稼働日数 = max(1, ceil(estimateDays))
 * - 前タスクの終了の翌稼働日から次タスクを開始する(直列)
 */
export function scheduleTasks(
  tasks: EstimatedTask[],
  startDate: Date,
  holidays: ReadonlySet<string> = new Set(),
): ScheduledTask[] {
  const result: ScheduledTask[] = [];
  let cursor = nextWorkingDay(startDate, holidays);

  for (const task of tasks) {
    const duration = Math.max(1, Math.ceil(task.estimateDays || 0));
    const plannedStart = nextWorkingDay(cursor, holidays);
    let counted = 1;
    let day = new Date(plannedStart.getTime());
    while (counted < duration) {
      day.setTime(day.getTime() + DAY_MS);
      day = nextWorkingDay(day, holidays);
      counted += 1;
    }
    const plannedEnd = day;
    result.push({ id: task.id, plannedStart, plannedEnd });
    // 次タスクは終了の翌日(以降の最初の稼働日)から
    cursor = nextWorkingDay(new Date(plannedEnd.getTime() + DAY_MS), holidays);
  }

  return result;
}
