// 工程の順序付け (US-045)。同一対象配下のタスクを「前工程→後工程」で並べるための順位。
// 各レビュー工程は対応する開発工程の直後に来るようにする。

const DEV_PHASES: { key: string; matches: string[] }[] = [
  { key: '基本設計', matches: ['基本設計'] },
  { key: '詳細設計', matches: ['詳細設計'] },
  { key: 'コーディング', matches: ['コーディング', '実装', 'コード'] },
  { key: '単体テスト', matches: ['単体'] },
  { key: '結合テスト', matches: ['結合'] },
];

/**
 * 工程名から順位を返す。基本設計(0)→基本設計レビュー(1)→詳細設計(2)→… の順。
 * 未知の工程は末尾側(レビューはさらに後ろ)。
 */
export function phaseRank(phase: string | null | undefined): number {
  if (!phase) return 80;
  const isReview = phase.includes('レビュー');
  for (let i = 0; i < DEV_PHASES.length; i++) {
    if (DEV_PHASES[i]!.matches.some((m) => phase.includes(m))) {
      return i * 2 + (isReview ? 1 : 0);
    }
  }
  return isReview ? 91 : 90;
}
