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

// ---- リカバリプラン (US-011) ----

export interface RecoveryTask {
  id: string;
  name: string;
  estimateDays: number;
  assigneeName: string | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  progress: number;
}

export type Severity = 'high' | 'medium' | 'low';

export interface RecoveryAction {
  taskId: string;
  taskName: string;
  severity: Severity;
  behindBy: number;
  /** 残作業の概算(人日) = 見積 × 残進捗率 */
  remainingDays: number;
  suggestions: string[];
}

export interface RecoveryPlan {
  delayedCount: number;
  totalRemainingDays: number;
  actions: RecoveryAction[];
}

function severityOf(behindBy: number): Severity {
  if (behindBy >= 50) return 'high';
  if (behindBy >= 20) return 'medium';
  return 'low';
}

/**
 * 遅延タスクからリカバリプラン案を生成する (US-011)。
 * 遅れ量・残作業・担当の有無から、決め打ちのヒューリスティックで挽回策を提示する。
 */
export function buildRecoveryPlan(
  tasks: RecoveryTask[],
  now: Date,
  thresholdPct = 0,
): RecoveryPlan {
  const actions: RecoveryAction[] = [];

  for (const task of tasks) {
    const delay = detectDelay(
      {
        id: task.id,
        name: task.name,
        assigneeId: task.assigneeName ? 'x' : null,
        plannedStart: task.plannedStart,
        plannedEnd: task.plannedEnd,
        progress: task.progress,
      },
      now,
      thresholdPct,
    );
    if (!delay.isDelayed) continue;

    const remainingDays =
      Math.round(task.estimateDays * ((100 - delay.actualProgress) / 100) * 10) / 10;
    const severity = severityOf(delay.behindBy);
    const suggestions: string[] = [];

    if (!task.assigneeName) {
      suggestions.push('担当者が未割当。まず要員を割り当てる');
    }
    if (severity === 'high') {
      suggestions.push('重度の遅延。応援要員の追加投入とスコープ(優先度)の見直しを検討する');
      suggestions.push('後続タスクへの影響が大きいため、関係者へ早期にエスカレーションする');
    } else if (severity === 'medium') {
      suggestions.push('中度の遅延。応援要員のアサインまたは短期の残業計画で挽回する');
    } else {
      suggestions.push('軽微な遅延。日次で進捗を確認し早期に巻き返す');
    }
    if (remainingDays > 0) {
      suggestions.push(`残作業は約 ${remainingDays} 人日。並行作業で分担すると短縮できる`);
    }

    actions.push({
      taskId: task.id,
      taskName: task.name,
      severity,
      behindBy: delay.behindBy,
      remainingDays,
      suggestions,
    });
  }

  actions.sort((a, b) => b.behindBy - a.behindBy);
  const totalRemainingDays =
    Math.round(actions.reduce((s, a) => s + a.remainingDays, 0) * 10) / 10;

  return { delayedCount: actions.length, totalRemainingDays, actions };
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
  /** 稼働率 (0 < r <= 1)。未指定は 1.0(専従)。 */
  utilizationRate?: number;
  /** 依存グループ(同一対象=同じ親)。同じ groupKey は配列順(=工程順)に直列。未指定はタスク固有(依存なし)。 */
  groupKey?: string;
  /** 要員。同じ resourceKey は直列。未指定/未割当は共通プールで直列。 */
  resourceKey?: string;
  /** 実績進捗率 0-100。0 より大きいと「着手済み」として開始日を固定する (US-042)。 */
  progress?: number;
  /** 既存の計画開始/終了。着手済み/完了タスクのアンカーに使う (US-042)。 */
  fixedStart?: Date | null;
  fixedEnd?: Date | null;
}

const UNASSIGNED_KEY = '__unassigned__';

export interface ScheduledTask {
  id: string;
  plannedStart: Date;
  plannedEnd: Date;
}

/** 稼働率を 0 < r <= 1 に正規化する(不正値・未指定は 1.0)。 */
export function normalizeUtilization(rate: number | undefined | null): number {
  if (rate == null || Number.isNaN(rate) || rate <= 0) return 1;
  return Math.min(1, rate);
}

const HOUR_MS = 60 * 60 * 1000;
/** 始業時刻(UTC基準, 既定 9 時)。小数日のバー描画と整合させる。 */
export const DAY_START_HOUR = 9;

/** 工数(人日)と稼働率から必要な稼働日数(小数, 切り上げない)を返す (US-012 / US-040)。
 * 稼働日数 = 工数 ÷ 稼働率。例: 0.6人日 ÷ 0.2 = 3.0、3人日 ÷ 0.75 = 4.0、1人日 ÷ 1 = 1.0、0.5人日 ÷ 1 = 0.5。 */
export function workingDaysNeeded(estimateDays: number, utilizationRate?: number): number {
  const effort = Math.max(0, estimateDays || 0);
  const rate = normalizeUtilization(utilizationRate);
  return effort / rate;
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function atHour(dayMidnight: Date, hour: number): Date {
  return new Date(dayMidnight.getTime() + hour * HOUR_MS);
}

/** カーソルを「稼働日の勤務時間内の開始位置」へ丸める(非稼働日・時間外なら次の稼働日始業へ)。 */
function rollToWorkStart(
  cursor: Date,
  holidays: ReadonlySet<string>,
  hoursPerDay: number,
  dayStartHour: number,
): Date {
  const dayEndHour = dayStartHour + hoursPerDay;
  let c = new Date(cursor.getTime());
  for (let i = 0; i < 4000; i++) {
    const day = utcMidnight(c);
    if (!isWorkingDay(day, holidays)) {
      c = atHour(nextWorkingDay(new Date(day.getTime() + DAY_MS), holidays), dayStartHour);
      continue;
    }
    const hour = (c.getTime() - day.getTime()) / HOUR_MS;
    if (hour < dayStartHour) {
      c = atHour(day, dayStartHour);
      break;
    }
    if (hour >= dayEndHour - 1e-9) {
      c = atHour(nextWorkingDay(new Date(day.getTime() + DAY_MS), holidays), dayStartHour);
      continue;
    }
    break;
  }
  return c;
}

/** 開始時刻から勤務時間 occHours 分だけ稼働時間を消費した終了時刻を返す。 */
function advanceWorkingHours(
  start: Date,
  occHours: number,
  holidays: ReadonlySet<string>,
  hoursPerDay: number,
  dayStartHour: number,
): Date {
  const dayEndHour = dayStartHour + hoursPerDay;
  let remaining = occHours;
  let cur = new Date(start.getTime());
  while (remaining > 1e-9) {
    const day = utcMidnight(cur);
    const dayEnd = atHour(day, dayEndHour);
    const avail = (dayEnd.getTime() - cur.getTime()) / HOUR_MS;
    if (remaining <= avail + 1e-9) {
      cur = new Date(cur.getTime() + remaining * HOUR_MS);
      remaining = 0;
    } else {
      remaining -= avail;
      cur = atHour(nextWorkingDay(new Date(day.getTime() + DAY_MS), holidays), dayStartHour);
    }
  }
  return cur;
}

/**
 * 見積(人日)・稼働率・依存・要員を考慮してタスクをスケジューリングする (US-004 / US-012 / US-040 / US-041)。
 * - 稼働日(土日・祝日を除く)の勤務時間内に、小数人日をそのまま(切り上げずに)割り付ける(コマ無し)
 * - 開始 = max(プロジェクト開始, 同一 groupKey の直前タスク終了, 同一 resourceKey の直前タスク終了)
 *   → 同一対象配下は工程順に直列、同一要員は直列、別グループ/別要員は並行
 * - plannedStart/End は時刻まで保持する(例: 0.5人日 → 始業 9:00〜13:00)
 * - tasks は呼び出し側で WBS 順(工程順)に並べておくこと(groupKey 内の順序がそのまま依存順になる)
 */
export function scheduleTasks(
  tasks: EstimatedTask[],
  startDate: Date,
  holidays: ReadonlySet<string> = new Set(),
  hoursPerDay = 8,
  dayStartHour = DAY_START_HOUR,
): ScheduledTask[] {
  const result: ScheduledTask[] = [];
  const base = rollToWorkStart(
    atHour(utcMidnight(startDate), dayStartHour),
    holidays,
    hoursPerDay,
    dayStartHour,
  );
  const groupLastEnd = new Map<string, Date>();
  const resourceLastEnd = new Map<string, Date>();

  const laterOf = (a: Date | undefined, b: Date): Date =>
    a && a.getTime() > b.getTime() ? a : b;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    const groupKey = task.groupKey ?? `__task_${i}__`; // 未指定は依存なし(自分専用)
    const resourceKey = task.resourceKey ?? UNASSIGNED_KEY;
    const occHours = workingDaysNeeded(task.estimateDays, task.utilizationRate) * hoursPerDay;
    const progress = task.progress ?? 0;
    // 着手済み(進捗>0)で既存開始があるタスクはアンカー(開始固定) (US-042)
    const anchored = progress > 0 && task.fixedStart != null;

    let plannedStart: Date;
    let plannedEnd: Date;
    if (anchored) {
      plannedStart = new Date(task.fixedStart!.getTime());
      if (progress >= 100 && task.fixedEnd) {
        // 完了タスクは終了も固定
        plannedEnd = new Date(task.fixedEnd.getTime());
      } else {
        // 着手中は開始固定のまま、工数に応じて終了を伸縮
        plannedEnd = advanceWorkingHours(plannedStart, occHours, holidays, hoursPerDay, dayStartHour);
      }
    } else {
      let earliest = base.getTime();
      const g = groupLastEnd.get(groupKey);
      if (g) earliest = Math.max(earliest, g.getTime());
      const r = resourceLastEnd.get(resourceKey);
      if (r) earliest = Math.max(earliest, r.getTime());
      plannedStart = rollToWorkStart(new Date(earliest), holidays, hoursPerDay, dayStartHour);
      plannedEnd = advanceWorkingHours(plannedStart, occHours, holidays, hoursPerDay, dayStartHour);
    }

    result.push({ id: task.id, plannedStart, plannedEnd });
    // 後続の起点には「これまでの最遅終了」を使う(アンカーが早くても鎖は巻き戻さない)
    groupLastEnd.set(groupKey, laterOf(groupLastEnd.get(groupKey), plannedEnd));
    resourceLastEnd.set(resourceKey, laterOf(resourceLastEnd.get(resourceKey), plannedEnd));
  }

  return result;
}
