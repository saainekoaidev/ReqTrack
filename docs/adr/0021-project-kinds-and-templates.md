# 0021 案件区分マスタと見積テンプレート(AI/定型の選択)

## Status

Accepted (US-024 の固定 new/existing を見直し、US-036/060 の AI 見積に定型運用を追加)

## Context

案件区分が `new`/`existing` 固定で増減できず、見積も AI 生成のみだった。組織で統制の取れた定型(標準的な見積・タスク項目)を持ち、AI と使い分けたいという要望。区分も組織により異なる。完全自由ではなく「統制された方法も選べる」形が望ましい。

## Decision

- **案件区分マスタ `ProjectKind`**(設定で増減・修正)。各区分は `requiresReference`(参照資料を要するか)を持つ。初期登録: 新規開発 / 既存改修(要参照) / マイグレーション(要参照)。`Project.kind` には区分名を保存。
  - AI 見積の「既存モード(資料参照)」判定は、固定文字列ではなく **参照資料が紐づくか(`referenceProjectId`)** で行う。
- **見積テンプレート `EstimateTemplate`**(items を JSON で保持: `{wbsId, level, name, phase?, estimateDays?, utilizationRate?, note?}[]`)。
  - 新規作成の「見積・ガント」で **AIで生成 / 定型を適用** を選べる(`POST /api/projects/:id/apply-template`)。
  - 既存プロジェクトの WBS から **テンプレート保存**(`/api/estimate-templates/from-project`)。
  - 初期テンプレート: **マイグレーション標準**(現行調査・更新情報収集・環境構築・現新比較試験・移行 等。AI 知見ベース、後で調整可)。
- 設定に「案件区分・テンプレート」タブを追加(区分 CRUD・テンプレート一覧/削除)。

## Consequences

- 区分・定型を組織で管理でき、AI と定型を選択可能(統制と自由の両立)。
- `Project.kind` が任意文字列になったため、既存モード判定は参照資料の有無に一本化(後方互換)。
- テンプレートは JSON 保持で柔軟だが、項目単位の GUI 編集は未提供(保存/適用/削除のみ。項目編集は将来)。
