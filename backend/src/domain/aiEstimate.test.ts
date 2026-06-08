import { describe, it, expect } from 'vitest';
import { buildEstimatePrompt, parseEstimateResponse } from './aiEstimate.js';

describe('buildEstimatePrompt (US-036 / US-040)', () => {
  it('要件と前提・出力指示・3階層(対象=画面/帳票)を含む', () => {
    const p = buildEstimatePrompt({
      projectName: '案件A',
      kind: 'existing',
      hoursPerDay: 8,
      requirements: [{ content: 'ログイン改修', references: [{ path: 'a.java', snippet: 'class X' }] }],
    });
    expect(p).toContain('案件A');
    expect(p).toContain('既存改修');
    expect(p).toContain('ログイン改修');
    expect(p).toContain('a.java');
    expect(p).toContain('JSON のみ');
    expect(p).toContain('対象');
    expect(p).toContain('targets');
  });
});

describe('parseEstimateResponse (US-036 / US-040)', () => {
  it('3階層(機能→対象→作業)を抽出し検証する', () => {
    const out =
      'はい、以下です。\n```json\n{"features":[{"name":"ログイン","targets":[{"name":"SCR-001(ログイン画面)","tasks":[{"name":"設計","phase":"基本設計","estimateDays":1.5,"reason":"画面1つ"}]}]}]}\n```\n以上';
    const r = parseEstimateResponse(out);
    expect(r.features[0]!.name).toBe('ログイン');
    expect(r.features[0]!.targets[0]!.name).toBe('SCR-001(ログイン画面)');
    expect(r.features[0]!.targets[0]!.tasks[0]).toMatchObject({ phase: '基本設計', estimateDays: 1.5 });
  });

  it('旧形式(tasks 直下)は単一の対象に正規化する', () => {
    const out =
      '{"features":[{"name":"ログイン","tasks":[{"name":"設計","phase":"基本設計","estimateDays":1,"reason":""}]}]}';
    const r = parseEstimateResponse(out);
    expect(r.features[0]!.targets).toHaveLength(1);
    expect(r.features[0]!.targets[0]!.name).toContain('ログイン');
    expect(r.features[0]!.targets[0]!.tasks[0]!.phase).toBe('基本設計');
  });

  it('JSON が無ければエラー', () => {
    expect(() => parseEstimateResponse('JSONはありません')).toThrow();
  });

  it('形式不正はエラー', () => {
    expect(() => parseEstimateResponse('{"features":[]}')).toThrow();
  });

  it('作業が1つも無ければエラー', () => {
    expect(() => parseEstimateResponse('{"features":[{"name":"x","targets":[]}]}')).toThrow();
  });
});
