// レビュー自動展開 (US-014)。DB 非依存の純粋関数。
// ce2 の review_rules に倣い、開発工程の後に PL レビューを自動挿入する。
// dev のレビュー対応は明示しない(次工程の遅れとして暗黙吸収)。

export interface ReviewRule {
  /** 対象とする開発工程(タスクの phase に含まれる文字列) */
  trigger: string;
  /** 生成するレビュー工程名 */
  reviewPhase: string;
  /** wbsId サフィックス(例: 2r設) */
  suffix: string;
  /** ソース工数に対する比率 */
  ratio: number;
  /** 最低工数(人日) */
  min: number;
}

export const REVIEW_RULES: ReviewRule[] = [
  { trigger: '基本設計', reviewPhase: '基本設計レビュー', suffix: '設', ratio: 0.3, min: 0.25 },
  { trigger: '詳細設計', reviewPhase: '詳細設計レビュー', suffix: '詳', ratio: 0.3, min: 0.25 },
  { trigger: 'コーディング', reviewPhase: 'コードレビュー', suffix: 'コ', ratio: 0.3, min: 0.25 },
  { trigger: '単体テスト', reviewPhase: '単体テストケースレビュー', suffix: '単', ratio: 0.3, min: 0.25 },
];

export interface DevTaskLite {
  phase: string | null;
  estimateDays: number;
}

export interface ReviewSpec {
  wbsId: string;
  name: string;
  phase: string;
  estimateDays: number;
  estimateNote: string;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * 1 機能分のレビュータスクを算出する。
 * - レビュー工数 = max(対象工程の工数合計 × ratio, min)
 * - 既存レビュー(phase に「レビュー」を含む)は対象外(二重生成防止)
 * - 対象工程が無い(合計 0)ルールはスキップ
 */
export function computeReviewTasks(
  featureNo: number | string,
  devTasks: DevTaskLite[],
  rules: ReviewRule[] = REVIEW_RULES,
): ReviewSpec[] {
  const specs: ReviewSpec[] = [];
  for (const rule of rules) {
    const sum = devTasks
      .filter((t) => t.phase && t.phase.includes(rule.trigger) && !t.phase.includes('レビュー'))
      .reduce((s, t) => s + (t.estimateDays || 0), 0);
    if (sum <= 0) continue;
    const wl = Math.max(round3(sum * rule.ratio), rule.min);
    specs.push({
      wbsId: `${featureNo}r${rule.suffix}`,
      name: rule.reviewPhase,
      phase: rule.reviewPhase,
      estimateDays: wl,
      estimateNote: `${rule.trigger} 工数 ${round3(sum)} 人日 × ${rule.ratio}(下限 ${rule.min})`,
    });
  }
  return specs;
}
