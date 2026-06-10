import type { Task } from '../api/client';
import { sortTasksByWbs } from './wbs';

// ガントチャート描画用の純粋なジオメトリ計算 (US-004 / US-040)。
// 稼働時間軸(working-time): 土日祝を圧縮し、小数人日をそのまま反映する連続軸。コマ(セル)区切りは持たない。
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** 始業時刻(UTC基準)。バックエンドのスケジューラと一致させる。 */
export const DAY_START_HOUR = 9;

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function isWeekend(d: Date): boolean {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}
function isWorkingDate(d: Date, holidays: ReadonlySet<string>): boolean {
  return !isWeekend(d) && !holidays.has(dayKey(d));
}

/** [from, toExcl) 間の稼働日数を数える(いずれも UTC 0:00)。 */
function countWorkingDays(from: Date, toExcl: Date, holidays: ReadonlySet<string>): number {
  let c = 0;
  let d = new Date(from.getTime());
  while (d.getTime() < toExcl.getTime()) {
    if (isWorkingDate(d, holidays)) c += 1;
    d = new Date(d.getTime() + DAY_MS);
  }
  return c;
}

/** datetime を稼働時間軸の位置(稼働日単位の小数)へ変換する(基準日からの稼働日数 + 当日内の割合)。 */
function workingTime(
  dt: Date,
  baseDay: Date,
  holidays: ReadonlySet<string>,
  hoursPerDay: number,
): number {
  const day = utcMidnight(dt);
  const whole = countWorkingDays(baseDay, day, holidays);
  const hour = (dt.getTime() - day.getTime()) / HOUR_MS;
  const frac = Math.min(1, Math.max(0, (hour - DAY_START_HOUR) / hoursPerDay));
  return whole + frac;
}

export interface AxisDay {
  date: Date;
  /** 稼働時間軸でのこの日の開始位置(= 稼働日インデックス) */
  wtStart: number;
}

export interface GanttRow {
  task: Task;
  /** 階層の深さ(level-1, 0 起点) */
  depth: number;
  hasChildren: boolean;
  ancestorIds: string[];
  /** 稼働時間軸での開始/終了(小数)。計画日が無ければ null。 */
  startWT: number | null;
  endWT: number | null;
  /** 表示用集計: この行(配下含む)の工数合計(人日) */
  totalDays: number;
  /** 達成率(%) 0-100。葉は自身、親は配下の葉を工数で加重平均 (US-048)。 */
  progress: number;
  /** 表示用の開始/終了 datetime(配下の最小開始・最大終了)。 */
  startDate: Date | null;
  endDate: Date | null;
}

export interface GanttModel {
  rows: GanttRow[];
  axis: AxisDay[];
  /** 軸全体の稼働日数(小数, バー幅計算の分母) */
  totalWT: number;
  /** 年/月ヘッダ(年込み) */
  months: { label: string; span: number }[];
}

/**
 * 計画日(plannedStart/End)を持つ葉タスクからガントモデルを構築する (US-040)。
 * - 親行(機能/対象)は配下の葉から開始/終了/工数を集計して表示する
 * - 行は WBS 番号順(プレオーダー)、各行に depth と祖先IDを付与(折り畳み用)
 */
export function buildGantt(
  tasks: Task[],
  holidays: ReadonlySet<string> = new Set(),
  hoursPerDay = 8,
): GanttModel {
  const planned = tasks.filter((t) => t.plannedStart && t.plannedEnd);
  if (planned.length === 0) return { rows: [], axis: [], totalWT: 0, months: [] };

  const baseDay = utcMidnight(
    new Date(Math.min(...planned.map((t) => new Date(t.plannedStart!).getTime()))),
  );
  const maxEndDay = utcMidnight(
    new Date(Math.max(...planned.map((t) => new Date(t.plannedEnd!).getTime()))),
  );

  // 稼働日軸を構築(基準日〜最大終了日の稼働日のみ)
  const axis: AxisDay[] = [];
  for (let d = new Date(baseDay.getTime()); d.getTime() <= maxEndDay.getTime(); d = new Date(d.getTime() + DAY_MS)) {
    if (isWorkingDate(d, holidays)) axis.push({ date: new Date(d.getTime()), wtStart: axis.length });
  }
  // 軸全体長: 最終稼働日の終わり(= 稼働日数)。最低でも葉の最大終了位置を含める。
  let totalWT = axis.length;
  for (const t of planned) {
    totalWT = Math.max(totalWT, workingTime(new Date(t.plannedEnd!), baseDay, holidays, hoursPerDay));
  }
  if (totalWT <= 0) totalWT = 1;

  // 親子関係
  const childrenByParent = new Map<string, Task[]>();
  const byId = new Map<string, Task>();
  for (const t of tasks) {
    byId.set(t.id, t);
    if (t.parentId) {
      const arr = childrenByParent.get(t.parentId) ?? [];
      arr.push(t);
      childrenByParent.set(t.parentId, arr);
    }
  }

  // 配下の葉(計画日を持つもの)を再帰収集
  function leavesOf(task: Task): Task[] {
    const kids = childrenByParent.get(task.id);
    if (!kids || kids.length === 0) {
      return task.plannedStart && task.plannedEnd ? [task] : [];
    }
    return kids.flatMap((k) => leavesOf(k));
  }
  function ancestorsOf(task: Task): string[] {
    const ids: string[] = [];
    let cur = task.parentId ? byId.get(task.parentId) : undefined;
    let guard = 0;
    while (cur && guard < 100) {
      ids.push(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      guard += 1;
    }
    return ids;
  }

  const ordered = sortTasksByWbs(tasks);
  const rows: GanttRow[] = ordered.map((task) => {
    const hasChildren = (childrenByParent.get(task.id)?.length ?? 0) > 0;
    const leaves = hasChildren ? leavesOf(task) : task.plannedStart && task.plannedEnd ? [task] : [];
    let startWT: number | null = null;
    let endWT: number | null = null;
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    for (const lf of leaves) {
      const s = new Date(lf.plannedStart!);
      const e = new Date(lf.plannedEnd!);
      const sWT = workingTime(s, baseDay, holidays, hoursPerDay);
      const eWT = workingTime(e, baseDay, holidays, hoursPerDay);
      if (startWT == null || sWT < startWT) {
        startWT = sWT;
        startDate = s;
      }
      if (endWT == null || eWT > endWT) {
        endWT = eWT;
        endDate = e;
      }
    }
    const totalDays = hasChildren
      ? Math.round(leaves.reduce((sum, lf) => sum + (lf.estimateDays || 0), 0) * 1000) / 1000
      : task.estimateDays || 0;
    // 達成率: 葉は自身、親は配下の葉を工数で加重平均(工数0なら単純平均) (US-048)
    let progress: number;
    if (!hasChildren) {
      progress = task.progress ?? 0;
    } else if (leaves.length === 0) {
      progress = 0;
    } else {
      const w = leaves.reduce((s, lf) => s + (lf.estimateDays || 0), 0);
      progress =
        w > 0
          ? Math.round(leaves.reduce((s, lf) => s + (lf.progress ?? 0) * (lf.estimateDays || 0), 0) / w)
          : Math.round(leaves.reduce((s, lf) => s + (lf.progress ?? 0), 0) / leaves.length);
    }
    return {
      task,
      depth: (task.level ?? 3) - 1,
      hasChildren,
      ancestorIds: ancestorsOf(task),
      startWT,
      endWT,
      totalDays,
      progress,
      startDate,
      endDate,
    };
  });

  // 年/月ヘッダ(年込み)
  const months: { label: string; span: number }[] = [];
  for (const a of axis) {
    const label = `${a.date.getUTCFullYear()}年${a.date.getUTCMonth() + 1}月`;
    const last = months[months.length - 1];
    if (last && last.label === label) last.span += 1;
    else months.push({ label, span: 1 });
  }

  return { rows, axis, totalWT, months };
}

/**
 * 全体進捗率(見積で重み付けした加重平均) (US-008)。
 * 葉(子を持たない)タスクのみを対象にする。
 */
export function overallProgress(tasks: Task[]): number {
  const childIds = new Set(tasks.map((t) => t.parentId).filter(Boolean) as string[]);
  const leaves = tasks.filter((t) => !childIds.has(t.id) && t.kind !== 'efficiency');
  if (leaves.length === 0) return 0;
  const totalWeight = leaves.reduce((s, t) => s + (t.estimateDays || 0), 0);
  if (totalWeight === 0) {
    return Math.round(leaves.reduce((s, t) => s + t.progress, 0) / leaves.length);
  }
  const weighted = leaves.reduce((s, t) => s + t.progress * (t.estimateDays || 0), 0);
  return Math.round(weighted / totalWeight);
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];
export function weekdayJa(d: Date): string {
  return WEEKDAY_JA[d.getUTCDay()] ?? '';
}
/** 年込みの日付表記(例: 2026/6/8)。 */
export function fmtDateYmd(d: Date | string | null): string {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getUTCFullYear()}/${x.getUTCMonth() + 1}/${x.getUTCDate()}`;
}

// 工程→色(ce2 のガントバー配色に倣う) (US-015)
const PHASE_COLOR_TABLE: { match: string; color: string }[] = [
  { match: 'レビュー', color: '#fff3bf' },
  { match: '基本設計', color: '#a5d8ff' },
  { match: '詳細設計', color: '#b2f2bb' },
  { match: 'コーディング', color: '#ffd8a8' },
  { match: '実装', color: '#ffd8a8' },
  { match: '単体テスト', color: '#fcc2d7' },
  { match: '結合テスト', color: '#d0bfff' },
];

/** 工程名から対応する色を返す(未該当は既定色)。 */
export function phaseColor(phase: string | null | undefined): string {
  if (phase) {
    for (const { match, color } of PHASE_COLOR_TABLE) {
      if (phase.includes(match)) return color;
    }
  }
  return '#ced4da';
}

/** 凡例(工程→色)。表示順は配色テーブル準拠。 */
export function phaseLegend(): { label: string; color: string }[] {
  return [
    { label: '基本設計', color: phaseColor('基本設計') },
    { label: '詳細設計', color: phaseColor('詳細設計') },
    { label: 'コーディング', color: phaseColor('コーディング') },
    { label: '単体テスト', color: phaseColor('単体テスト') },
    { label: '結合テスト', color: phaseColor('結合テスト') },
    { label: 'レビュー', color: phaseColor('レビュー') },
  ];
}

/**
 * 担当者別の工数(人日)集計。効率化(負/集約行)と親(子を持つ)行は除外。 (US-015)
 * hoursPerDay を渡すと単価(円/時)から工賃概算 cost も算出する (US-028)。
 */
export function workloadByAssignee(
  tasks: Task[],
  hoursPerDay?: number,
): { name: string; days: number; cost: number | null }[] {
  const childIds = new Set(tasks.map((t) => t.parentId).filter(Boolean) as string[]);
  const agg = new Map<string, { days: number; cost: number; hasRate: boolean }>();
  for (const t of tasks) {
    if (t.kind === 'efficiency') continue;
    if (childIds.has(t.id)) continue; // 親(集約)行は除外
    if (!t.estimateDays || t.estimateDays <= 0) continue;
    const name = t.assignee?.name ?? '(未割当)';
    const rate = t.assignee?.hourlyRate ?? null;
    const cur = agg.get(name) ?? { days: 0, cost: 0, hasRate: false };
    cur.days += t.estimateDays;
    if (hoursPerDay && rate != null) {
      cur.cost += t.estimateDays * hoursPerDay * rate;
      cur.hasRate = true;
    }
    agg.set(name, cur);
  }
  return [...agg.entries()]
    .map(([name, v]) => ({
      name,
      days: Math.round(v.days * 1000) / 1000,
      cost: v.hasRate ? Math.round(v.cost) : null,
    }))
    .sort((a, b) => b.days - a.days);
}
