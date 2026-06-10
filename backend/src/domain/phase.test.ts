import { describe, it, expect } from 'vitest';
import { phaseRank } from './phase.js';

describe('phaseRank (US-045)', () => {
  it('前工程→後工程、各レビューは対応工程の直後', () => {
    const order = [
      '基本設計',
      '基本設計レビュー',
      '詳細設計',
      '詳細設計レビュー',
      'コーディング',
      'コードレビュー',
      '単体テスト',
      '単体テストケースレビュー',
      '結合テスト',
    ];
    const ranks = order.map((p) => phaseRank(p));
    // 単調増加であること
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]!).toBeGreaterThan(ranks[i - 1]!);
    }
  });

  it('実装/コードもコーディング工程として扱う', () => {
    expect(phaseRank('実装')).toBe(phaseRank('コーディング'));
    expect(phaseRank('コードレビュー')).toBeGreaterThan(phaseRank('コーディング'));
  });

  it('未知/未設定は末尾側', () => {
    expect(phaseRank(null)).toBeGreaterThanOrEqual(80);
    expect(phaseRank('打合せ')).toBeGreaterThanOrEqual(80);
  });
});
