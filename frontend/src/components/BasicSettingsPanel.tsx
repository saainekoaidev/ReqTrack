import { useEffect, useState } from 'react';
import { api, type Settings } from '../api/client';

// 基本設定パネル (US-022 / US-027)。範囲制限つきで見積・スケジュールの基本値を編集する。
type FieldKey = keyof Omit<Settings, 'id'>;
const FIELDS: { key: FieldKey; label: string; min: number; max: number; step: number; help: string }[] = [
  { key: 'hoursPerDay', label: '1日の作業時間(時間)', min: 1, max: 24, step: 0.5, help: '工賃計算・時間換算に使用' },
  { key: 'minEstimateDays', label: '見積の最小単位(人日)', min: 0.01, max: 1, step: 0.01, help: '工数入力の刻み(既定 0.1)' },
  { key: 'reviewRatio', label: 'レビュー率', min: 0, max: 1, step: 0.05, help: '対象工程の工数 × この率' },
  { key: 'reviewMinDays', label: 'レビュー下限(人日)', min: 0, max: 5, step: 0.05, help: 'レビュー工数の下限' },
  { key: 'defaultUtilization', label: '既定の稼働率', min: 0.05, max: 1, step: 0.05, help: '新規タスクの初期稼働率' },
];

export default function BasicSettingsPanel() {
  const [form, setForm] = useState<Omit<Settings, 'id'> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then(({ id: _id, ...rest }) => setForm(rest))
      .catch((e: unknown) => setError(msg(e)));
  }, []);

  async function save() {
    if (!form) return;
    // クライアント側でも範囲チェック
    for (const f of FIELDS) {
      const v = form[f.key];
      if (Number.isNaN(v) || v < f.min || v > f.max) {
        setError(`${f.label} は ${f.min}〜${f.max} の範囲で入力してください`);
        return;
      }
    }
    try {
      const saved = await api.updateSettings(form);
      const { id: _id, ...rest } = saved;
      setForm(rest);
      setMessage('保存しました。');
      setError(null);
    } catch (e) {
      setError(msg(e));
    }
  }

  if (!form) {
    return (
      <div className="card">
        <h3>基本設定</h3>
        {error ? <p className="error" role="alert">{error}</p> : <p className="muted">読み込み中…</p>}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>基本設定</h3>
      <p className="muted">見積・スケジュールの基本値です。範囲内の任意値に変更できます。</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      <table className="data-table">
        <tbody>
          {FIELDS.map((f) => (
            <tr key={f.key}>
              <th style={{ width: '16rem' }}>{f.label}</th>
              <td>
                <input
                  type="number"
                  aria-label={f.label}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                  style={{ width: '7rem' }}
                />{' '}
                <span className="muted">
                  （{f.min}〜{f.max}）{f.help}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dialog-actions">
        <button type="button" onClick={save}>
          設定を保存
        </button>
      </div>
      <p className="muted">見積の対象範囲はシステム構築部分(基本設計〜結合テスト)です。</p>
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
