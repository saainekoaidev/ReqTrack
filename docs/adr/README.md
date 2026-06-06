# Architecture Decision Records (ADR)

このディレクトリは設計判断の記録を保管する。Michael Nygard 形式 (Status / Context / Decision / Consequences) を採用。

## いつ書くか

- ライブラリ / フレームワーク選定
- データモデル / DB スキーマの主要構造
- 命名規約 / ファイル配置規約
- 例外処理方針 / ロギング方針
- 認証 / 認可方式
- API 設計方針
- パフォーマンス / スケーリング判断
- セキュリティ判断
- 既存判断を覆す時 (古い ADR を Superseded にし, 新規 ADR を追加)

## 書き方

1. `0001-template.md` をコピーして連番 + 短い件名で保存 (例: `0002-frontend-framework.md`)
2. Status を `Proposed` で起票
3. PR レビュー / 議論を経て `Accepted` に変更
4. 後で覆す時は古い ADR を `Superseded by [ADR NNNN](...)` に変更し, 新規 ADR で経緯を記述

## 連番ルール

- 連番は欠番を作らない (Superseded のものも残す)
- 1 ADR = 1 トピック。複数判断を 1 ADR に詰めない
