import { describe, it, expect } from 'vitest';
import { expandWbs, STANDARD_PHASES } from './wbs.js';

describe('expandWbs (US-013)', () => {
  it('対象なしは機能直下に標準工程をぶら下げる', () => {
    const nodes = expandWbs(1, 'ログイン機能', []);
    expect(nodes[0]).toMatchObject({ level: 1, wbsId: '1', name: 'ログイン機能' });
    const l3 = nodes.filter((n) => n.level === 3);
    expect(l3).toHaveLength(STANDARD_PHASES.length);
    expect(l3[0]).toMatchObject({ wbsId: '1.1', phase: '基本設計', parentTempId: 'f' });
    expect(l3[4]).toMatchObject({ wbsId: '1.5', phase: '結合テスト' });
  });

  it('対象ありは level2 を挟んで 3 階層になる', () => {
    const nodes = expandWbs(2, '検収機能', ['一覧画面', '帳票A'], ['基本設計', 'コーディング']);
    const l2 = nodes.filter((n) => n.level === 2);
    expect(l2.map((n) => n.wbsId)).toEqual(['2.1', '2.2']);
    const first = nodes.find((n) => n.wbsId === '2.1.1');
    expect(first).toMatchObject({ level: 3, name: '一覧画面 基本設計', phase: '基本設計' });
    const last = nodes.find((n) => n.wbsId === '2.2.2');
    expect(last).toMatchObject({ name: '帳票A コーディング', phase: 'コーディング' });
  });
});
