// 基本設定パネル (US-022)。見積/スケジュールの諸元(現状は固定値)を表示する。
// ※ 将来 DB の設定エンティティ化が必要になれば別途対応(現状は方針の明示)。
export default function BasicSettingsPanel() {
  const rows: [string, string][] = [
    ['1 日の作業時間', '8 時間'],
    ['見積の単位', '人日(小数点第3位までの自由値。0.25 粒度・コマは廃止)'],
    ['稼働率の考え方', '期間(営業日) = 工数 ÷ 稼働率'],
    ['レビュー工数', '対象工程 × 0.3(下限 0.25 人日)を自動展開'],
    ['効率化調整', '複数機能同時実施の重複削減を負の工数で表現'],
    ['非稼働日', '土日 + 登録済みの祝日'],
    ['見積スコープ', 'システム構築部分(基本設計〜結合テスト)'],
  ];
  return (
    <div className="card">
      <h3>基本設定</h3>
      <p className="muted">見積・スケジュールの基本方針です(現状は固定値)。</p>
      <table className="data-table">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th style={{ width: '12rem' }}>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
