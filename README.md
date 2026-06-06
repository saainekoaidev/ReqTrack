# claude-workflow-starter

VSCode + Claude Code を使った小規模システム構築のための **GitHub テンプレートリポジトリ**。
要件定義 → 設計 → 製造 → テスト の流れを *single source of truth ドキュメント運用* + *per-US merge ceremony* で回すための雛形を最小限詰め込んでいる。

## 由来

[saainekoaidev/wg05-sandbox](https://github.com/saainekoaidev/wg05-sandbox) で 2-3 画面規模の小システム実装を一通り回した経験から, **スタックに依存しない部分** (workflow / governance / ドキュメント運用) を抜き出して作成した。

## 同梱されているもの

```
CLAUDE.md                            # ガードレール + per-US merge ceremony
.claude/settings.json                # Claude Code の tool 権限 (空 → プロジェクトで埋める)
.gitignore                           # 汎用パターン (Node.js / IDE / Playwright)
docs/
├── requirements.md                  # 要件 (US リスト) のヘッダのみ
├── design.md                        # 設計書テンプレ (アーキ / データ / API)
├── ui.md                            # 画面仕様テンプレ
└── adr/
    ├── 0001-template.md             # ADR フォーマット
    └── README.md                    # ADR の運用説明
.github/
├── PULL_REQUEST_TEMPLATE.md         # PR 本文に Closes #N を促す
├── ISSUE_TEMPLATE/
│   ├── feature.md                   # User Story (US) Issue 雛形
│   ├── bug.md                       # bug Issue 雛形
│   └── config.yml                   # blank issue 無効化
└── workflows/
    └── ci.yml                       # CI 雛形 (構造のみ。ステップは stack 確定後に追記)
```

## 使い方

### 1. このテンプレートから新しいリポジトリを作成

GitHub の Web UI なら "Use this template" → "Create a new repository" ボタン。

CLI なら:

```bash
gh repo create your-org/new-project --template saainekoaidev/claude-workflow-starter --public --clone
cd new-project
```

### 2. プロジェクト固有の置換

最初に以下を編集する:

- [ ] `CLAUDE.md` の「プロジェクト名」「プロジェクト概要」「採用ツール (Tier 1)」を埋める
- [ ] `README.md` をプロジェクト用に書き換える (本ファイルは starter の説明のため)
- [ ] `docs/requirements.md` に最初の US を書き始める
- [ ] `docs/design.md` のアーキテクチャ概要・データモデル・API 仕様を実装方針が固まったら埋める
- [ ] `docs/ui.md` に画面一覧と遷移を書き始める
- [ ] `docs/adr/0002-*.md` から実際の ADR を採番開始 (例: `0002-frontend-framework.md`)
- [ ] `.github/workflows/ci.yml` の TODO コメントに従い stack-specific なステップ (install / build / test) を埋める
- [ ] `.gitignore` に stack 固有のパターン (例: `*.db`, `.next/` 等) を追加

### 3. GitHub Project ボードを作成 (任意)

```bash
gh project create --owner @me --title "your-project backlog"
```

`docs/requirements.md` で起こした各 US を Issue 化し, Project にぶら下げて Todo / In Progress / Done で管理する。

### 4. 最初の US を起票

要件は **必ず `docs/requirements.md` にまず追記** → その記述を元に Issue を起票。逆順 (Issue 先に起こして doc に転記) は doc が後回しになるため避ける。

### 5. 実装ループ

1 US に対して:

1. ブランチ作成: `git switch -c feat/us-NNN-<slug>`
2. 実装 + テスト
3. commit (CLAUDE.md の commit ガイドラインに準拠)
4. PR 作成: 本文に `Closes #N` を必須で含める
5. CI が緑になるのを待つ
6. `gh pr merge N --squash --delete-branch`
7. `git switch main && git pull --ff-only && git fetch --prune`
8. Project ボードの該当 item を Done 列へ

詳細は `CLAUDE.md` の「per-US merge ceremony」を参照。

## 同梱しないものの理由

以下は意図的に含まれていない:

- **`frontend/` `backend/` のコード骨格**: スタック未確定の段階で骨格を入れると後の `init` の自由度を奪う。実装方針 (React / Vue / Hono / Express 等) を ADR で決めてから `pnpm create` 等で生成する。
- **具体的な US や ADR (0002 以降)**: プロジェクト固有のためゼロから書く。
- **画面イメージ (`docs/ui-images/`)**: 設計フェーズで Figma 等から生成する想定。
- **依存ライブラリ (`package.json` 等)**: スタック決定後に新規作成。

## ライセンス

MIT
