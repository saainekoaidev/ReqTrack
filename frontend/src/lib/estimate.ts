// 見積(工数・稼働率)に関する純粋計算 (US-012)。backend domain/schedule.ts と整合させる。

export const HOURS_PER_DAY = 8;

/** 稼働率を 0 < r <= 1 に正規化(不正・未指定は 1.0)。 */
export function normalizeUtilization(rate: number | undefined | null): number {
  if (rate == null || Number.isNaN(rate) || rate <= 0) return 1;
  return Math.min(1, rate);
}

/** 工数(人日)の実作業時間 = 人日 × 8h。 */
export function effortHours(estimateDays: number): number {
  return round3(Math.max(0, estimateDays || 0) * HOURS_PER_DAY);
}

/**
 * カレンダー上の所要営業日数 = ceil(工数 ÷ 稼働率)。最低 1。
 * 例: 0.6 人日 ÷ 0.2 = 3 営業日。
 */
export function spanWorkingDays(estimateDays: number, utilizationRate?: number): number {
  const effort = Math.max(0, estimateDays || 0);
  const rate = normalizeUtilization(utilizationRate);
  return Math.max(1, Math.ceil(effort / rate));
}

/** 小数第3位までに丸める(浮動小数の桁あふれ防止)。 */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
