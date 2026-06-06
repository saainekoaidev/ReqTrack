// 見積サマリの純粋計算 (US-016)。DB 非依存。

export interface EstimateTaskLite {
  phase: string | null;
  estimateDays: number;
  kind: string;
  assigneeName: string | null;
}

export interface EstimateSummary {
  byPhase: { phase: string; days: number }[];
  byAssignee: { name: string; days: number }[];
  /** 効率化調整の合計(負) */
  efficiency: number;
  /** 作業 + レビュー の合計(効率化を除く) */
  subtotal: number;
  /** 効率化込みの総計 */
  total: number;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** タスク群から工程別・担当者別の工数サマリと合計を算出する。 */
export function summarizeEstimate(tasks: EstimateTaskLite[]): EstimateSummary {
  const phaseMap = new Map<string, number>();
  const assigneeMap = new Map<string, number>();
  let efficiency = 0;
  let subtotal = 0;

  for (const t of tasks) {
    if (t.kind === 'efficiency') {
      efficiency += t.estimateDays;
      continue;
    }
    if (!t.estimateDays || t.estimateDays <= 0) continue;
    subtotal += t.estimateDays;
    const phase = t.phase ?? '(その他)';
    phaseMap.set(phase, (phaseMap.get(phase) ?? 0) + t.estimateDays);
    const name = t.assigneeName ?? '(未割当)';
    assigneeMap.set(name, (assigneeMap.get(name) ?? 0) + t.estimateDays);
  }

  const byPhase = [...phaseMap.entries()]
    .map(([phase, days]) => ({ phase, days: round3(days) }))
    .sort((a, b) => b.days - a.days);
  const byAssignee = [...assigneeMap.entries()]
    .map(([name, days]) => ({ name, days: round3(days) }))
    .sort((a, b) => b.days - a.days);

  return {
    byPhase,
    byAssignee,
    efficiency: round3(efficiency),
    subtotal: round3(subtotal),
    total: round3(subtotal + efficiency),
  };
}

/** WBS 番号の自然順比較(1, 1.1, 1.2, 2, 10 ...)。null は末尾。 */
export function naturalWbsCompare(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const sa = pa[i] ?? '';
    const sb = pb[i] ?? '';
    const na = Number(sa);
    const nb = Number(sb);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    if (sa !== sb) return sa < sb ? -1 : 1;
  }
  return 0;
}
