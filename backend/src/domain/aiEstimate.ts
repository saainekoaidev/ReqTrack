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
  lines.push('# WBS の階層(厳守)');
  lines.push('機能(feature) → 対象(target) → 作業(task) の 3 階層で構成すること。');
  lines.push(
    '対象(target)は機能が扱う「画面」または「帳票」とし、name は「画面ID(画面名)」「帳票ID(帳票名)」の形式で具体的に書く(例: SCR-001(ログイン画面), RPT-010(売上日報))。',
  );
  lines.push('各対象ごとに標準工程(基本設計/詳細設計/コーディング/単体テスト/結合テスト)に沿って作業(task)へ分解すること。');
  lines.push('');
  lines.push('# 出力(厳守)');
  lines.push('説明文やコードフェンスを一切付けず、次の JSON のみを出力すること:');
  lines.push(
    '{"features":[{"name":"機能名","targets":[{"name":"画面ID(画面名) または 帳票ID(帳票名)","tasks":[{"name":"作業名","phase":"工程(基本設計/詳細設計/コーディング/単体テスト/結合テストのいずれか)","estimateDays":数値,"reason":"見積根拠"}]}]}]}',
  );
  return lines.join('\n');
}

const taskSchema = z.object({
  name: z.string().min(1),
  phase: z.string().min(1),
  estimateDays: z.number().nonnegative(),
  reason: z.string().optional().default(''),
});
const targetSchema = z.object({
  name: z.string().min(1),
  tasks: z.array(taskSchema),
});
// 機能は targets(3階層)を基本とするが、旧形式(tasks 直下=2階層)も許容して正規化する。
const featureSchema = z.object({
  name: z.string().min(1),
  targets: z.array(targetSchema).optional(),
  tasks: z.array(taskSchema).optional(),
});
const responseSchema = z.object({
  features: z.array(featureSchema).min(1),
});

export interface EstimateTask {
  name: string;
  phase: string;
  estimateDays: number;
  reason: string;
}
export interface EstimateTarget {
  name: string;
  tasks: EstimateTask[];
}
export interface EstimateFeature {
  name: string;
  targets: EstimateTarget[];
}
export interface EstimateResponse {
  features: EstimateFeature[];
}

/** stdout から JSON を抽出し、3 階層(機能→対象→作業)に正規化して返す。 */
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
  // 正規化: targets が無く tasks 直下のみの場合は、機能名を冠した単一の対象でくるむ。
  const features: EstimateFeature[] = result.data.features.map((f) => {
    const targets: EstimateTarget[] =
      f.targets && f.targets.length > 0
        ? f.targets.map((t) => ({
            name: t.name,
            tasks: t.tasks.map((k) => ({ ...k, reason: k.reason ?? '' })),
          }))
        : [
            {
              name: `${f.name} 全般`,
              tasks: (f.tasks ?? []).map((k) => ({ ...k, reason: k.reason ?? '' })),
            },
          ];
    return { name: f.name, targets };
  });
  // 少なくとも1つの作業があること
  const hasAnyTask = features.some((f) => f.targets.some((t) => t.tasks.length > 0));
  if (!hasAnyTask) {
    throw new Error('AI の見積結果に作業(task)が含まれていませんでした。');
  }
  return { features };
}
