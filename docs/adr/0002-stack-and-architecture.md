# 0002 技術スタックと初期アーキテクチャ

## Status

Accepted

## Context

ReqTrack は、要件ヒアリング→タスク洗い出し→見積→ガント初版作成の上流工程と、進捗報告→進捗率反映→遅延検出→遅れ要員洗い出し→リカバリプラン提示の下流工程を、ガントチャートを中心に 1 システムで繋ぐ (`docs/requirements.md` US-001〜011)。

前提として「Web 上で動作する DB 利用システム」「テスト/CI を回す環境」が既に与えられている。VSCode + Claude Code で開発し、小規模・単一リポジトリで上流/下流を一体管理することが求められる。スタック未確定の雛形 (`claude-workflow-starter`) から開始するため、ここで初期構成を確定する。

## Decision

pnpm workspace の 2 パッケージ構成 (`frontend` / `backend`) とする。

- **frontend**: React 18 + Vite 6 + TypeScript。SPA としてガント UI / マスタ登録 / 進捗入力画面を担う。
- **backend**: Hono 4 + `@hono/node-server`。REST API を提供。入力検証は zod + `@hono/zod-validator`。
- **DB / ORM**: SQLite + Prisma 6。小規模・単一ノード・ゼロ運用コストで「DB 利用システム」要件を満たす。負荷が増えた場合は Prisma の datasource 差し替えで PostgreSQL へ移行できる (その際は新 ADR を起こす)。
- **テスト**: 単体/コンポーネントは Vitest (backend: node 環境 / frontend: jsdom + Testing Library)、E2E は Playwright。
- **遅延ロジックの配置**: 期待進捗・遅延判定・遅れ要員集約は DB 非依存の純粋関数 (`backend/src/domain/schedule.ts`) に切り出し、ユニットテストで担保する。
- **CI**: GitHub Actions。`build-test` ジョブ (install→prisma generate→typecheck→build→Vitest) と `e2e` ジョブ (Playwright) の 2 本。

代替案として frontend に Next.js、backend に Express も検討したが、(1) 上流/下流の薄い API 層には Hono が軽量で型補完も良好、(2) SSR 要件が無いため Vite SPA で十分、という理由で見送った。

## Consequences

- 単一リポジトリで上流/下流を一体管理でき、型 (Prisma 生成型) を backend 全体で共有できる。
- SQLite はファイル DB のため同時書き込み・水平スケールに弱い。本格運用前に PostgreSQL 等への移行判断が必要 (移行ポイントは ORM 層に限定済み)。
- frontend/backend 間で型を直接共有していない (現状は `client.ts` に手書き型)。将来 OpenAPI 生成や Hono RPC (`hc`) による型共有を検討する余地がある。
- Playwright のブラウザバイナリ取得が CI 時間を押し上げるため、e2e は別ジョブに分離した。
