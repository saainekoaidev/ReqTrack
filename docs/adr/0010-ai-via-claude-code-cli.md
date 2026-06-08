# 0010 AI 処理は Claude Code CLI(サブスク枠)で実行する

## Status

Accepted

## Context

見積生成など LLM を要する処理を実装する。ユーザ要件:
- **追加課金となる API 利用は不可**。現在の **Claude Code 契約の使用量枠**で処理する仕組みのみ許可。
- 既存ワークスペース `C:\_doc\DGMS` と**同方式**にすること。

DGMS は backend から `claude -p "<prompt>"`(Claude Code CLI 非対話モード)を子プロセス起動し、ログイン済み Claude Code の OAuth(サブスク枠)で LLM を実行している(ANTHROPIC_API_KEY 不使用)。DGMS ADR 0011/0013/0014 参照。

## Decision

ReqTrack も **Claude Code CLI を子プロセス起動**して AI 処理を行う。API キー課金は使わない。

### 実行ブリッジ(`backend/src/claude-cli.ts`)
- `resolveClaudeCliPath()`: `CLAUDE_CLI_PATH` env → DB 設定 → VSCode 拡張同梱バイナリ(`~/.vscode/extensions/anthropic.claude-code-*/.../claude(.exe)`) → PATH(`where`/`command -v`)の順で解決。
- `runClaude(prompt, { timeoutMs })`: `spawn(cli, ['-p', prompt], { shell(win), env, cwd })`。stdout を収集して返す。タイムアウト既定 5 分。`activeChildren` で追跡し PID kill でキャンセル可能。
- 認証は Claude Code 側の OAuth に委譲。`.env` は DATABASE_URL のみ(API キー無し)。

### 方式は Toolless(コンテキスト直埋め + JSON 出力)
DGMS の 2 方式のうち、MCP サーバを必要としない **Toolless** を採用:
- backend がプロンプトに要件・(既存案件は)参照資料の関連抜粋を埋め込む。
- 出力は **JSON のみ**を指示し、stdout から JSON を抽出して検証(zod)→ DB 反映。
- まず **AI 見積生成**: 要件群(＋ FTS で引いた参照資料抜粋)→ `[{ name, phase, estimateDays, reason }]` を生成し WBS タスク化(US-036)。

### 実行制御
- **同期実行**(API ハンドラ内で await)。フロントは既存の処理中インジケータ(US-033)で待機表示。
- CLI 未検出/失敗時は **分かりやすいエラー**を返す(画面に掲出)。クラッシュさせない。
- 時間がかかるため将来はジョブ化も検討(現状は同期 + タイムアウト)。

### 全文検索(US-035)で文脈を用意
参照資料(US-024 スキャン済みのテキスト抜粋)に **SQLite FTS5(trigram)** の索引を作り、見積対象の要件語で関連ファイルを引いて AI のコンテキストに渡す。

## Consequences

- 追加課金なしで、契約枠内で LLM 見積を実現。**ReqTrack 本体は通常の Web アプリ(backend サーバ + ブラウザ)で動き、VSCode の起動は不要。** AI 見積実行時にのみ、ログイン済みの `claude` CLI(VSCode 拡張同梱バイナリ等)を backend がサブプロセス起動する。
- CLI 非対話実行のため、CI/ヘッドレスや CLI 未導入環境では AI 機能のみ無効(その旨をエラー表示)。決定論的機能は従来どおり動作。
- プロンプト/出力契約は backend が持ち、出力は JSON 強制 + zod 検証で安全に取り込む。
- 既存の決定論ロジック(展開/スケジュール/遅延)は維持し、AI は「見積精緻化・要件→タスク生成」を担う(スケジュール・遅延の算術は AI 不要)。
- US-037: 要件→AI見積→スケジュール割付を 1 アクション(`POST /api/projects/:id/ai-plan`)で実行しガントを生成(ce2 の「要件→スケジュール表」に相当、出力はガント)。スケジュール割付は決定論の `scheduleProject()`(`/api/tasks/schedule` と共通)を AI 見積の後段で呼ぶ構成。
