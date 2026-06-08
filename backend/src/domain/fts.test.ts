import { describe, it, expect } from 'vitest';
import { sanitizeFtsQuery } from './fts.js';

describe('sanitizeFtsQuery (US-035)', () => {
  it('短すぎる/空はnull', () => {
    expect(sanitizeFtsQuery('')).toBeNull();
    expect(sanitizeFtsQuery(' a ')).toBeNull();
  });
  it('ダブルクオートで括りエスケープ', () => {
    expect(sanitizeFtsQuery('mikenshuFlg')).toBe('"mikenshuFlg"');
    expect(sanitizeFtsQuery('a"b')).toBe('"a""b"');
  });
});
