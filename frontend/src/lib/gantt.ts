import type { Task } from '../api/client';

// ガントチャート描画用の純粋なジオメトリ計算 (US-004)。
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GanttRow {
  task: Task;
  /** チャート左端(最小開始日)からの日数オフセット */
  startOffset: number;
  /** バーの長さ(日数、開始終了を含む) */
  duration: number;
}

export interface GanttModel {
  days: Date[];
  rows: GanttRow[];
}

function atUtcMidnight(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * 計画日(plannedStart/End)を持つタスクからガントモデルを構築する。
 * 計画日が未設定のタスクは除外する。
 */
export function buildGantt(tasks: Task[]): GanttModel {
  const planned = tasks.filter((t) => t.plannedStart && t.plannedEnd);
  if (planned.length === 0) return { days: [], rows: [] };

  const starts = planned.map((t) => atUtcMidnight(t.plannedStart!));
  const ends = planned.map((t) => atUtcMidnight(t.plannedEnd!));
  const min = new Date(Math.min(...starts.map((d) => d.getTime())));
  const max = new Date(Math.max(...ends.map((d) => d.getTime())));

  const totalDays = diffDays(min, max) + 1;
  const days = Array.from({ length: totalDays }, (_, i) => new Date(min.getTime() + i * DAY_MS));

  const rows: GanttRow[] = planned.map((task) => {
    const start = atUtcMidnight(task.plannedStart!);
    const end = atUtcMidnight(task.plannedEnd!);
    return {
      task,
      startOffset: diffDays(min, start),
      duration: diffDays(start, end) + 1,
    };
  });

  return { days, rows };
}

/**
 * 全体進捗率(見積で重み付けした加重平均) (US-008)。
 * 見積が全て 0 の場合はタスク数で単純平均する。
 */
export function overallProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const totalWeight = tasks.reduce((s, t) => s + (t.estimateDays || 0), 0);
  if (totalWeight === 0) {
    return Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length);
  }
  const weighted = tasks.reduce((s, t) => s + t.progress * (t.estimateDays || 0), 0);
  return Math.round(weighted / totalWeight);
}

/** 軸ラベル用に M/D を返す。 */
export function dayLabel(d: Date): string {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** 日付 + 曜日(例: 8\n月)用に、日と曜日を返す。 */
export function dayOfMonth(d: Date): number {
  return d.getUTCDate();
}
export function weekdayJa(d: Date): string {
  return WEEKDAY_JA[d.getUTCDay()] ?? '';
}

/** 土日か判定する(軸の色分け用)。 */
export function isWeekend(d: Date): boolean {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}

/** 月ヘッダ用に、連続日から「YYYY/M」ごとの列スパンを返す (US-015)。 */
export function monthSpans(days: Date[]): { label: string; span: number }[] {
  const out: { label: string; span: number }[] = [];
  for (const d of days) {
    const label = `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}`;
    const last = out[out.length - 1];
    if (last && last.label === label) last.span += 1;
    else out.push({ label, span: 1 });
  }
  return out;
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

/** 担当者別の工数(人日)集計。効率化(負/集約行)は除外。 (US-015) */
export function workloadByAssignee(tasks: Task[]): { name: string; days: number }[] {
  const map = new Map<string, number>();
  for (const t of tasks) {
    if (t.kind === 'efficiency') continue;
    if (!t.estimateDays || t.estimateDays <= 0) continue;
    const name = t.assignee?.name ?? '(未割当)';
    map.set(name, (map.get(name) ?? 0) + t.estimateDays);
  }
  return [...map.entries()]
    .map(([name, days]) => ({ name, days: Math.round(days * 1000) / 1000 }))
    .sort((a, b) => b.days - a.days);
}
