import { z } from 'zod';

// AI 見積のプロンプト生成と出力解析 (US-036)。DB/CLI 非依存の純粋関数。

export interface RequirementContext {
  content: string;
  /** 既存改修時、関連する参照資料の抜粋(任意) */
  references?: { path: string; snippet: string }[];
}

export interface EstimateInput {
  projectName: string;
  kind: 'new' | 'existing';
  requirements: RequirementContext[];
  hoursPerDay: number;
}

const STANDARD_PHASES = '基本設計 / 詳細設計 / コーディング / 単体テスト / 結合テスト';

/** Claude へ渡すプロンプトを組み立てる。出力は JSON のみを厳守させる。 */
export function buildEstimatePrompt(input: EstimateInput): string {
  const lines: string[] = [];
  lines.push('あなたはシステム開発の見積担当です。以下の要件について、システム構築部分の工数を見積もってください。');
  lines.push(`案件: ${input.projectName}（区分: ${input.kind === 'existing' ? '既存改修' : '新規開発'}）`);
  lines.push(`前提: 1日=${input.hoursPerDay}時間。見積対象はシステム構築(${STANDARD_PHASES})に限定。工数は人日(小数可)。`);
  if (input.kind === 'existing') {
    lines.push('既存改修のため、各要件に付与された参照資料の抜粋(既存設計/ソース)を踏まえて現実的に見積もること。');
  }
  lines.push('');
  lines.push('# 要件');
  input.requirements.forEach((r, i) => {
    lines.push(`## 要件${i + 1}: ${r.content}`);
    if (r.references && r.references.length > 0) {
      lines.push('参照資料(抜粋):');
      for (const ref of r.references.slice(0, 3)) {
        lines.push(`- ${ref.path}: ${ref.snippet.slice(0, 400).replace(/\s+/g, ' ')}`);
      }
    }
  });
  lines.push('');
  lines.push('# 出力(厳守)');
  lines.push('説明文やコードフェンスを一切付けず、次の JSON のみを出力すること:');
  lines.push(
    '{"features":[{"name":"機能名","tasks":[{"name":"作業名","phase":"工程(基本設計/詳細設計/コーディング/単体テスト/結合テストのいずれか)","estimateDays":数値,"reason":"見積根拠"}]}]}',
  );
  lines.push('各要件をひとつの機能(feature)とし、標準工程に沿って tasks を分解すること。');
  return lines.join('\n');
}

const taskSchema = z.object({
  name: z.string().min(1),
  phase: z.string().min(1),
  estimateDays: z.number().nonnegative(),
  reason: z.string().optional().default(''),
});
const responseSchema = z.object({
  features: z.array(z.object({ name: z.string().min(1), tasks: z.array(taskSchema) })).min(1),
});

export type EstimateResponse = z.infer<typeof responseSchema>;

/** stdout から JSON を抽出し検証して返す。コードフェンスや前後の文章があっても先頭の JSON を拾う。 */
export function parseEstimateResponse(stdout: string): EstimateResponse {
  const text = stdout.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('AI の出力から見積(JSON)を読み取れませんでした。');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('AI の出力(JSON)の解析に失敗しました。');
  }
  const result = responseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('AI の見積結果が想定の形式ではありませんでした。');
  }
  return result.data;
}
