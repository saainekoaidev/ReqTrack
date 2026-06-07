import { describe, it, expect } from 'vitest';
import {
  splitNaturalText,
  detectRequirementColumn,
  extractRequirements,
  parseEstimateRows,
  parseCsv,
} from './import.js';

describe('splitNaturalText (US-019)', () => {
  it('改行/箇条書き/句点で要件に分割し記号を除去', () => {
    const r = splitNaturalText('・ログイン機能が欲しい\n- 帳票出力。検索もしたい');
    expect(r).toEqual(['ログイン機能が欲しい', '帳票出力', '検索もしたい']);
  });
});

describe('extractRequirements (US-019)', () => {
  it('ヘッダに要件列があればその列を採用(テンプレ)', () => {
    const rows = [
      ['No', '改修内容', '優先度'],
      ['1', 'ログイン機能', '高'],
      ['2', '帳票出力', '中'],
    ];
    expect(detectRequirementColumn(rows[0]!)).toBe(1);
    expect(extractRequirements(rows)).toEqual(['ログイン機能', '帳票出力']);
  });

  it('要件列が無ければ各行の最長テキストセルを採用(自由体裁)', () => {
    const rows = [
      ['1', 'ログイン機能を実装する', '5'],
      ['2', '短い', '3'],
    ];
    expect(detectRequirementColumn(rows[0]!)).toBe(-1);
    expect(extractRequirements(rows)).toEqual(['ログイン機能を実装する', '短い']);
  });
});

describe('parseEstimateRows (US-019)', () => {
  it('ヘッダ別名で列をマッピングしタスク化、稼働率%を正規化', () => {
    const rows = [
      ['WBS', 'タスク', '工程', '工数(人日)', '稼働率', '担当'],
      ['1.1', '基本設計', '基本設計', '2', '75%', '山田'],
      ['1.2', '実装', 'コーディング', '3', '1', ''],
    ];
    const specs = parseEstimateRows(rows);
    expect(specs[0]).toMatchObject({
      wbsId: '1.1',
      name: '基本設計',
      phase: '基本設計',
      estimateDays: 2,
      utilizationRate: 0.75,
      assigneeName: '山田',
    });
    expect(specs[1]).toMatchObject({ name: '実装', estimateDays: 3, utilizationRate: 1 });
  });
});

describe('parseCsv (US-019)', () => {
  it('クオート/カンマを処理する', () => {
    const rows = parseCsv('a,b\n"x,y",z\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x,y', 'z'],
    ]);
  });
});
