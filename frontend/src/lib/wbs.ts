import type { Task } from '../api/client';

// WBS 採番・並び順の純粋ヘルパ (US-018)。

/** WBS番号の自然順比較(1, 1.1, 1.2, 2, 10 ...)。null は末尾。 */
export function naturalWbsCompare(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i] ?? '');
    const nb = Number(pb[i] ?? '');
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    const sa = pa[i] ?? '';
    const sb = pb[i] ?? '';
    if (sa !== sb) return sa < sb ? -1 : 1;
  }
  return 0;
}

/** WBS番号順にタスクを並べる(コピーを返す)。 */
export function sortTasksByWbs(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => naturalWbsCompare(a.wbsId, b.wbsId));
}

/** 新しい機能(level1)の wbsId = 既存 level1 数 + 1。 */
export function nextFeatureWbsId(tasks: Task[]): string {
  const n = tasks.filter((t) => t.level === 1).length;
  return String(n + 1);
}

/** 親配下の新しい子タスクの wbsId = 親wbsId + "." + (兄弟数 + 1)。 */
export function nextChildWbsId(parent: Task, tasks: Task[]): string {
  const base = parent.wbsId ?? String(parent.id);
  const siblings = tasks.filter((t) => t.parentId === parent.id).length;
  return `${base}.${siblings + 1}`;
}
