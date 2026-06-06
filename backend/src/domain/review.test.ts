import { describe, it, expect } from 'vitest';
import { computeReviewTasks } from './review.js';

describe('computeReviewTasks (US-014)', () => {
  it('対象工程の工数合計×0.3、下限0.25でレビューを生成', () => {
    const specs = computeReviewTasks(2, [
      { phase: '基本設計', estimateDays: 2 }, // ×0.3 = 0.6
      { phase: '詳細設計', estimateDays: 0.5 }, // ×0.3 = 0.15 → 下限0.25
      { phase: 'コーディング', estimateDays: 3 }, // ×0.3 = 0.9
    ]);
    const byPhase = Object.fromEntries(specs.map((s) => [s.phase, s]));
    expect(byPhase['基本設計レビュー']).toMatchObject({ wbsId: '2r設', estimateDays: 0.6 });
    expect(byPhase['詳細設計レビュー']!.estimateDays).toBe(0.25); // 下限
    expect(byPhase['コードレビュー']).toMatchObject({ wbsId: '2rコ', estimateDays: 0.9 });
  });

  it('対象工程が無いルールはスキップ、既存レビューは数えない', () => {
    const specs = computeReviewTasks(1, [
      { phase: '結合テスト', estimateDays: 5 }, // どのルールにも該当しない
      { phase: '基本設計レビュー', estimateDays: 1 }, // レビューは除外
    ]);
    expect(specs).toHaveLength(0);
  });
});
