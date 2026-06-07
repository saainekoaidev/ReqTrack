import { describe, it, expect } from 'vitest';
import { isTextLike, shouldSkipDir, makeExcerpt } from './referenceScan.js';

describe('referenceScan helpers (US-024)', () => {
  it('isTextLike はテキスト系拡張子を判定(大小無視)', () => {
    expect(isTextLike('.md')).toBe(true);
    expect(isTextLike('.TS')).toBe(true);
    expect(isTextLike('.png')).toBe(false);
  });

  it('shouldSkipDir は node_modules や隠しディレクトリを除外', () => {
    expect(shouldSkipDir('node_modules')).toBe(true);
    expect(shouldSkipDir('.git')).toBe(true);
    expect(shouldSkipDir('src')).toBe(false);
  });

  it('makeExcerpt は最大長で切り詰める', () => {
    expect(makeExcerpt('abc')).toBe('abc');
    const long = 'x'.repeat(2100);
    const ex = makeExcerpt(long, 2000);
    expect(ex.length).toBe(2000 + 4); // 2000 + ' ...'
    expect(ex.endsWith(' ...')).toBe(true);
  });
});
