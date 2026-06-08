# 設計書

> 実装方針 (フレームワーク選定 / データモデル / API 設計 / 主要コンポーネント構造 等) を記録する。
> 各章の判断根拠は `docs/adr/` の ADR に切り出し, 本書は「現在の状態」を表す。

## 1. アーキテクチャ概要

pnpm workspace のモノレポ。スタック選定の根拠は [ADR 0002](adr/0002-stack-and-architecture.md)。

```
reqtrack/
├── frontend/   React 18 + Vite 6 + TypeScript (SPA)
│   └── e2e/    Playwright
├── backend/    Hono 4 + @hono/node-server (REST API)
│   ├── prisma/ schema.prisma + migrations + seed
│   └── src/
│       ├── routes/    members / holidays / tasks
│       └── domain/    schedule.ts (遅延ロジック / DB 非依存)
└── docs/       requirements.md / design.md / ui.md / adr/
```

- 主要技術スタック: React, Vite, TypeScript / Hono, Prisma, SQLite / Vitest, Playwright / GitHub Actions。
- dev 時は frontend (`:5174`) が `/api` を backend (`:8788`) へ Vite proxy で転送する。
  - ポートは DGMS(`:5173` / `:8787`)と衝突しないよう **5174 / 8788** を採用。起動は `tools/launch-reqtrack.ps1`(デスクトップショートカットから)。

## 2. データモデル

一次正は [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma)。

| エンティティ | 役割 | 関連 US |
|---|---|---|
| `Project` | 案件 = 1 ガントチャート | 全体 |
| `Requirement` | ヒアリング/提示された要件 | US-001, US-002 |
| `Member` | 要員(担当者/報告者) | US-005 |
| `Holiday` | 祝日(非稼働日) | US-006 |
| `Task` | タスク/工程。見積・計画日・進捗率を保持 | US-002, US-003, US-004, US-008 |
| `ProgressReport` | 進捗報告(履歴) | US-007 |

主なリレーション: `Project 1—* Requirement`, `Project 1—* Task`, `Requirement 1—* Task`, `Member 1—* Task` (担当), `Task 1—* ProgressReport`, `Member 1—* ProgressReport`。

## 3. API

ベースパス `/api`。入出力は JSON。検証は zod (不正入力は 400)。

| Method | Path | 概要 | US |
|---|---|---|---|
| GET | `/api/health` | ヘルスチェック | — |
| GET/PUT | `/api/settings` | 全体設定(範囲制限つき) | US-027 |
| GET | `/api/fs/list?path=` | サーバ側フォルダ参照(ディレクトリ一覧) | US-031 |
| POST | `/api/holidays/import?year=` | 日本の祝日を一括取得 | US-025 |
| GET/POST | `/api/projects` | プロジェクト一覧/作成(kind=new/existing, referenceProjectId 可) | US-001, US-024 |
| GET/POST | `/api/reference-projects` | 参照資料プロジェクト 一覧/登録 | US-024 |
| GET | `/api/reference-projects/:id` | 参照資料の詳細(ファイル) | US-024 |
| POST | `/api/reference-projects/:id/scan` | 資料フォルダをスキャンし読取り | US-024 |
| DELETE | `/api/reference-projects/:id` | 参照資料プロジェクト削除 | US-024 |
| GET | `/api/projects/:id` | プロジェクト取得 | US-001 |
| DELETE | `/api/projects/:id` | プロジェクト削除(配下を連動削除) | US-030 |
| POST | `/api/projects/:id/expand-reviews` | レビュー自動展開(機能ごとに PL レビュー) | US-014 |
| POST | `/api/projects/:id/efficiency` | 効率化調整(負の工数 1 行) | US-014 |
| POST | `/api/projects/:id/import/requirements-text` | 自然文→要件(任意で標準工程展開) | US-019 |
| POST | `/api/projects/:id/import/requirements-file` | ファイル(xlsx/csv)→要件 | US-019 |
| POST | `/api/projects/:id/import/estimate-file` | ファイル(xlsx/csv)→見積明細タスク | US-019 |
| GET | `/api/projects/:id/estimate.xlsx` | 見積 Excel(見積諸元+根拠/WBS/ガント) | US-016 |
| GET | `/api/requirements?projectId=` | 要件一覧 | US-001 |
| POST | `/api/requirements` | 要件登録 | US-001 |
| DELETE | `/api/requirements/:id` | 要件削除 | US-001 |
| POST | `/api/requirements/:id/expand` | 要件から WBS(機能→対象→作業タスク)+標準工程展開 | US-013 |
| GET | `/api/members` | 要員一覧 | US-005 |
| POST | `/api/members` | 要員登録 | US-005 |
| DELETE | `/api/members/:id` | 要員削除 | US-005 |
| GET | `/api/holidays` | 祝日一覧 | US-006 |
| POST | `/api/holidays` | 祝日登録 | US-006 |
| DELETE | `/api/holidays/:id` | 祝日削除 | US-006 |
| GET | `/api/tasks?projectId=` | タスク一覧 | US-002, US-004 |
| POST | `/api/tasks` | タスク登録(level/parentId/wbsId/phase 可) | US-002, US-018 |
| DELETE | `/api/tasks/:id` | タスク削除(子は連鎖削除) | US-018 |
| PATCH | `/api/tasks/:id` | タスク部分更新(見積/計画日/担当/進捗) | US-003 |
| POST | `/api/tasks/schedule` | ガント初版生成(稼働日割付) | US-004 |
| POST | `/api/tasks/:id/reports` | 進捗報告→進捗率反映 | US-007, US-008 |
| GET/POST | `/api/daily-reports?projectId=` | 日報の一覧/登録(複数タスク進捗を一括反映) | US-017 |
| GET | `/api/daily-reports/:id` | 日報の詳細(明細) | US-017 |
| GET | `/api/tasks/delays?projectId=` | 遅延タスク検出 | US-009 |
| GET | `/api/tasks/delays/members?projectId=` | 遅れ要員の洗い出し | US-010 |
| GET | `/api/tasks/recovery?projectId=` | リカバリプラン案生成 | US-011 |

> 上流の要件→タスク自動洗い出し/見積/ガント初版生成 (US-001〜004 の自動化) と、リカバリプラン提示 (US-011) は、本初期構成では CRUD/検出 API までを用意し、AI 生成ロジックは後続 US で実装する。

## 4. 認証 / 権限

初期構成では未実装(社内・単一テナント前提)。要員ログインと role (PM / 要員) 設計は後続 US で ADR を起こして決める。

## 5. 例外処理 / エラーレスポンス

- 入力検証エラー: 400 (`@hono/zod-validator`)。
- 未定義ルート: 404 `{ "error": "Not Found" }`。
- 想定外例外: 500 `{ "error": "Internal Server Error" }` (`app.onError` で集約)。
- frontend は API 失敗時に `role="alert"` でエラー表示し、画面自体は描画を継続する。

## 6. 主要コンポーネント

- `frontend/src/App.tsx`: トップ画面 (要員一覧の表示)。
- `frontend/src/api/client.ts`: backend API クライアント。
- `frontend/src/styles/app.css`: **デザインシステムの一次正** (CSS token / theme)。他所に同等定義を置かない。
- `backend/src/app.ts`: Hono アプリ生成 (`createApp`)。テストから `app.request()` で再利用。
- `backend/src/domain/schedule.ts`: 期待進捗・遅延判定・遅れ要員集約 (純粋関数)。

## 7. テスト戦略

| レイヤ | ツール | 対象 |
|---|---|---|
| 単体 (純粋ロジック) | Vitest (node) | `domain/schedule.ts` の遅延算定 |
| API (DB 非依存経路) | Vitest + `app.request` | health / 404 / バリデーション 400 |
| コンポーネント | Vitest (jsdom) + Testing Library | `App.tsx` の取得/エラー表示 |
| E2E | Playwright | トップ画面の表示 |

DB を伴う API 統合テストは、migrate 済み SQLite を用意して後続で追加する。
