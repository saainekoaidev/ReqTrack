// 全文検索(FTS5)用の純粋ヘルパ (US-035)。DB 非依存。

/**
 * FTS5 MATCH 用にクエリを安全化する。
 * - trigram トークナイザ前提。前後空白除去、空/短すぎる語は null。
 * - ダブルクオートで括り(エスケープ)、構文記号による誤動作を防ぐ。
 */
export function sanitizeFtsQuery(q: string): string | null {
  const t = (q ?? '').trim();
  if (t.length < 2) return null;
  return `"${t.replace(/"/g, '""')}"`;
}
