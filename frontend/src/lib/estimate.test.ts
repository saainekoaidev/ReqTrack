import { describe, it, expect } from 'vitest';
import { effortHours, spanWorkingDays, normalizeUtilization, round3 } from './estimate';

describe('estimate helpers (US-012)', () => {
  it('effortHours は 人日×8h', () => {
    expect(effortHours(3)).toBe(24);
    expect(effortHours(0.6)).toBe(4.8);
  });

  it('spanWorkingDays = ceil(工数 ÷ 稼働率)', () => {
    expect(spanWorkingDays(3, 1)).toBe(3); // 100% → 3営業日
    expect(spanWorkingDays(0.6, 0.2)).toBe(3); // 20% → 3営業日
    expect(spanWorkingDays(3, 0.75)).toBe(4); // 2.25日 → 切上げ4営業日
    expect(spanWorkingDays(0, 1)).toBe(1); // 最低1
  });

  it('normalizeUtilization は 0<r<=1 に収める', () => {
    expect(normalizeUtilization(undefined)).toBe(1);
    expect(normalizeUtilization(0)).toBe(1);
    expect(normalizeUtilization(1.5)).toBe(1);
    expect(normalizeUtilization(0.25)).toBe(0.25);
  });

  it('round3 は小数第3位まで', () => {
    expect(round3(1.23456)).toBe(1.235);
  });
});
