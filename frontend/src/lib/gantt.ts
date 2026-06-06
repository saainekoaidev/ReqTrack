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

/** 土日か判定する(軸の色分け用)。 */
export function isWeekend(d: Date): boolean {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}
