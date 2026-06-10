// 案件区分マスタ・見積テンプレートの初期データ (US-060)。

export interface TemplateItem {
  wbsId: string;
  level: number; // 1=機能 2=対象 3=作業
  name: string;
  phase?: string;
  estimateDays?: number; // 親(機能/対象)は省略可。葉(作業)のみ持つ
  utilizationRate?: number;
  note?: string;
}

export const KIND_SEED: { name: string; note: string; requiresReference: boolean; sortOrder: number }[] = [
  { name: '新規開発', note: '新規にシステムを構築する案件', requiresReference: false, sortOrder: 1 },
  { name: '既存改修', note: '既存システムの改修(改修対象の設計/ソース等の参照資料が必要)', requiresReference: true, sortOrder: 2 },
  {
    name: 'マイグレーション',
    note: 'サーバOS/RDBMS等の更新に伴う既存システムの動作確認(主に更新情報の収集と現新比較試験。システム改修を伴わない場合は現新比較が中心)',
    requiresReference: true,
    sortOrder: 3,
  },
];

// マイグレーションの標準テンプレート(AI知見による初期項目。詳細は後で調整する想定)。
const D = '基本設計';
const DD = '詳細設計';
const CD = 'コーディング';
const UT = '単体テスト';
const IT = '結合テスト';

export const MIGRATION_TEMPLATE: { name: string; projectKind: string; items: TemplateItem[] } = {
  name: 'マイグレーション標準',
  projectKind: 'マイグレーション',
  items: [
    { wbsId: '1', level: 1, name: '移行計画・調査' },
    { wbsId: '1.1', level: 2, name: '現行/更新調査' },
    { wbsId: '1.1.1', level: 3, name: '現行環境調査(OS/RDBMS/ミドル構成)', phase: D, estimateDays: 2, note: '現行構成の棚卸し' },
    { wbsId: '1.1.2', level: 3, name: '更新内容・互換性情報の収集', phase: D, estimateDays: 2, note: '更新版の変更点/非互換の調査' },
    { wbsId: '1.1.3', level: 3, name: '移行方式・手順の策定', phase: DD, estimateDays: 1.5, note: '移行手順/切戻し方針' },
    { wbsId: '2', level: 1, name: '環境構築' },
    { wbsId: '2.1', level: 2, name: '新環境' },
    { wbsId: '2.1.1', level: 3, name: '新OS/RDBMS環境の構築', phase: CD, estimateDays: 2 },
    { wbsId: '2.1.2', level: 3, name: 'アプリ配備・設定移行', phase: CD, estimateDays: 1.5 },
    { wbsId: '3', level: 1, name: '現新比較試験' },
    { wbsId: '3.1', level: 2, name: '機能比較' },
    { wbsId: '3.1.1', level: 3, name: '比較試験項目の作成', phase: UT, estimateDays: 2 },
    { wbsId: '3.1.2', level: 3, name: '現行環境での結果採取', phase: UT, estimateDays: 1.5 },
    { wbsId: '3.1.3', level: 3, name: '新環境での実行・突合', phase: IT, estimateDays: 2 },
    { wbsId: '3.2', level: 2, name: '性能・運用比較' },
    { wbsId: '3.2.1', level: 3, name: '性能測定(現新比較)', phase: IT, estimateDays: 1.5 },
    { wbsId: '3.2.2', level: 3, name: 'バッチ/運用試験', phase: IT, estimateDays: 1.5 },
    { wbsId: '4', level: 1, name: '移行・本番' },
    { wbsId: '4.1', level: 2, name: 'リハーサル/本番移行' },
    { wbsId: '4.1.1', level: 3, name: '移行リハーサル', phase: IT, estimateDays: 1 },
    { wbsId: '4.1.2', level: 3, name: '不具合対応', phase: CD, estimateDays: 1 },
    { wbsId: '4.1.3', level: 3, name: '本番移行', phase: IT, estimateDays: 1 },
  ],
};

/** WBS項目配列からタスク作成用に親子を解決した順序付きリストへ整形する。 */
export function resolveTemplateItems(
  items: TemplateItem[],
): { item: TemplateItem; parentWbsId: string | null }[] {
  return items.map((item) => {
    const parts = item.wbsId.split('.');
    const parentWbsId = parts.length > 1 ? parts.slice(0, -1).join('.') : null;
    return { item, parentWbsId };
  });
}
