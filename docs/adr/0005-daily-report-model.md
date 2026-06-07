# 0005 日報(複数タスク進捗報告)のデータモデル

## Status

Accepted

## Context

US-007 の進捗報告は「タスク 1 件ごとにその場で進捗率を送る」形だった。US-017 で、要員が日々「日報」として **複数の WBS タスクの進捗率+コメントをまとめて登録**し、一覧に蓄積、リンクから詳細を確認、登録内容をガントの進捗率・全体進捗へ反映し、遅延時はコメントから要因を辿る、という運用にしたい。

「日報 = 1 提出(報告者・日付・複数タスク行)」という単位が必要になり、既存の `ProgressReport`(タスク単位の 1 行)をどうグルーピングするかを決める。

## Decision

**日報ヘッダ `DailyReport` を新設し、既存 `ProgressReport` をその明細行として紐付ける**。

- `DailyReport { id, projectId, memberId, reportDate, note?, createdAt }`
  - 1 日報は 1 プロジェクトに属する(新規ダイアログでプロジェクトを選び、そのタスクから明細を作る)。一覧の絞り込みも projectId で行う。
- `ProgressReport` に `dailyReportId?`(任意 FK)を追加。日報経由の明細はこれを持つ(US-007 個別報告との後方互換のため nullable)。
- 登録時の処理(トランザクション):
  1. `DailyReport` を作成
  2. 明細ごとに `ProgressReport`(dailyReportId, taskId, memberId=報告者, progress, comment)を作成
  3. 各 `Task.progress` を明細の progress で更新(**最新の日報が勝つ**)= ガント/全体進捗(US-008)へ反映
- 遅延の要因追跡(US-009 連携): 遅延タスク検出 API に「そのタスクの最新 ProgressReport コメント」を含め、ダッシュボードから要因コメントを参照できるようにする。

## Considered Alternatives

- **フラットな ProgressReport のみ(ヘッダ無し)**: (memberId, date) で UI 集約する案。日報単位の note やリンク詳細・一意な「提出」概念が表しにくく、一覧/詳細の実装が複雑化するため却下。
- **DailyReport に projectId を持たせない(タスク横断)**: 実運用は 1 プロジェクト単位で、一覧の絞り込みも projectId が自然。横断は当面不要なため projectId を持たせる。

## Consequences

- 一覧=日報、詳細=明細、という自然な 2 階層になり、リンク選択での詳細ダイアログが素直に作れる。
- `Task.progress` は「最新の日報の値」を表す(履歴は `ProgressReport` に残る)。
- 既存の US-007 個別報告 API は維持(dailyReportId=null の明細として共存)。
- 遅延ダッシュボードにコメントを出すことで「遅れの要因を探る」導線が成立する。
