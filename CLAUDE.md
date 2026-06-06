# プロジェクト名 — 作業指示

> このファイルは [claude-workflow-starter](https://github.com/saainekoaidev/claude-workflow-starter) から bootstrap された雛形です。プロジェクト固有の内容に置き換えて運用してください。

## プロジェクト概要

(プロジェクトの目的・想定スコープ・対象ユーザを 2-3 行で記述)

---

## ガードレール

- 設計判断 (ライブラリ選定 / データ構造 / 命名規約 / 例外処理方針 等) を行った際は, `docs/adr/` に新規 ADR ファイルを追加する。ファイル名は連番 + 短い件名 (例: `0002-state-management.md`), 中身は `0001-template.md` の構成 (Status / Context / Decision / Consequences) に従う。
- 新しい要件が発生した場合は, まず `docs/requirements.md` に追記する。次にその要件を元に GitHub Issue を起票する。要件文書を起点に Issue を派生させる順序を守り, 要件の全体像が常に `docs/requirements.md` で把握できる状態を保つ。
- 画面に関する判断 (画面構成 / 遷移 / 操作フロー / 主要 UI 要素) を行った場合は, `docs/ui.md` に反映する。画面仕様の最新状態が常に 1 か所で確認できる状態を保つ。
- デザインシステム (共通 CSS / token / theme) の一次正は実装フェーズで決めて記録する (例: `frontend/src/styles/app.css`)。決まった後は他所に同等定義を置かない。
- 要点: ｢判断や変更は必ず該当ドキュメント (ADR / requirements.md / ui.md) に先に書く → そこから派生作業｣ という single source of truth を徹底する。

---

## per-US merge ceremony

User Story (要件 1 件分) の実装が完了したら, 以下の手順で main に取り込み Project ボードを Done に進める。

- 未マージのコミットがある場合のみ実施 (なければ「完了済み」として扱う)
- ブランチ名は `feat/us-NNN-<short-slug>` (例: `feat/us-012-station-master-import`)
- PR 本文に `Closes #N` を含めて Issue の auto-close を仕掛ける (`Issue: #N` と参照しただけでは auto-close しない)
- CI が緑になるのを待ってから squash-merge + ブランチ削除: `gh pr merge N --squash --delete-branch`
- ローカルは `git switch main && git pull --ff-only` で同期, `git fetch --prune` で stale な remote-tracking branch を除去
- ブランチ名から US 番号を推定し, Project ボード上の対応 item を Done 列へ移動
- CI red / merge conflict / その他予想外の状態が出た場合は止めて報告

---

## やってはいけないこと

- `--no-verify` での pre-commit hook スキップ (hook が失敗した場合は原因を直す)
- main / master への force push
- secrets (.env / token / credentials) のコミット
- 同じ問題に対する小さな fix 用の US を連発する (実装に手戻りが多い時は方向性自体を見直す)
- ユーザが特定方向 (例: 幅を広げる) を指示したのに別方向 (例: 内側を縮める) を「広げる効果」と称して実装する

---

## ノウハウ (本 starter kit が継承するパターン)

- **CSS / レイアウトの iterate は data-driven な根拠を最初に置く**: 「max-width をいくつにするか」より「想定される最大コンテンツ × 必要数 + α」のような根拠を先に決める。
- **US の粒度は意味で切る**: 軽微な follow-up fix は同じ US 内で commit を追加するか, `fix(US-NNN)` プレフィックスで PR だけ追加して Issue は再オープンしないという選択肢もある。番号を消費するかは「設計上の判断が変わったか」で判断する。
- **ADR は Superseded を活用**: 一度決めた方針を後から変える時は古い ADR を Superseded にし, 新しい ADR で経緯を残す。決定の系譜を追えるようにする。

---

## 採用ツール (Tier 1)

実装フェーズで確定したら以下を埋める:

| # | ツール | 担う工程 |
|---|---|---|
| 1 | VSCode + Claude Code | AI支援開発の中核 |
| 2 | Git + GitHub | ソース管理 |
| 3 | GitHub Issues + Projects | バックログ |
| 4 | (UI ツール) | UI 設計 |
| 5 | docs/ + docs/adr/ | 設計書 + ADR |
| 6 | CLAUDE.md + .claude/settings.json | ガードレール |
| 7 | GitHub Actions | CI/CD |
| 8 | (テストフレームワーク) | 単体テスト |
