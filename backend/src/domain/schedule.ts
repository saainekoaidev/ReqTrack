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
