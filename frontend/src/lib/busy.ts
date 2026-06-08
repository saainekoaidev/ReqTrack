import { useEffect, useState } from 'react';

// グローバルな処理中インジケータ用ストア (US-033)。
// API 呼び出し(client.request 等)が begin/end を呼び、ヘッダの表示が追従する。
let count = 0;
const listeners = new Set<(n: number) => void>();

function emit() {
  for (const l of listeners) l(count);
}

export function beginBusy(): void {
  count += 1;
  emit();
}

export function endBusy(): void {
  count = Math.max(0, count - 1);
  emit();
}

/** 現在処理中(>0)か、をヘッダ等で購読する。 */
export function useBusy(): number {
  const [n, setN] = useState(count);
  useEffect(() => {
    listeners.add(setN);
    setN(count);
    return () => {
      listeners.delete(setN);
    };
  }, []);
  return n;
}
