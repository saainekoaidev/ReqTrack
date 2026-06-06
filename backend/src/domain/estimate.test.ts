import { describe, it, expect } from 'vitest';
import { summarizeEstimate, naturalWbsCompare } from './estimate.js';

describe('summarizeEstimate (US-016)', () => {
  it('工程別・担当者別に集計し、効率化を総計へ反映', () => {
    const s = summarizeEstimate([
      { phase: '基本設計', estimateDays: 2, kind: 'task', assigneeName: '山田' },
      { phase: 'コーディング', estimateDays: 3, kind: 'task', assigneeName: '山田' },
      { phase: '基本設計レビュー', estimateDays: 0.6, kind: 'review', assigneeName: 'PL' },
      { phase: null, estimateDays: -1, kind: 'efficiency', assigneeName: null },
    ]);
    expect(s.subtotal).toBe(5.6);
    expect(s.efficiency).toBe(-1);
    expect(s.total).toBe(4.6);
    expect(s.byAssignee[0]).toEqual({ name: '山田', days: 5 });
    expect(s.byPhase.find((p) => p.phase === 'コーディング')?.days).toBe(3);
  });
});

describe('naturalWbsCompare', () => {
  it('WBS番号を自然順に並べる', () => {
    const arr = ['10', '2', '1.10', '1.2', '1', null];
    arr.sort(naturalWbsCompare);
    expect(arr).toEqual(['1', '1.2', '1.10', '2', '10', null]);
  });
});
