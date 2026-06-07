import { useEffect, useState, type FormEvent } from 'react';
import { api, type Holiday } from '../api/client';

// 祝日登録パネル (US-006 / 設定タブ US-022)。
export default function HolidaysPanel() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState(2026);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listHolidays().then(setHolidays).catch((e: unknown) => setError(msg(e)));
  }
  useEffect(reload, []);

  async function importYear() {
    setMessage('取得中…');
    try {
      const r = await api.importHolidays(year);
      setMessage(`${r.year} 年の祝日を ${r.added} 件登録しました(取得 ${r.fetched} 件)。`);
      setError(null);
      reload();
    } catch (e) {
      setMessage(null);
      setError(msg(e));
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!date || !name.trim()) return;
    try {
      const h = await api.createHoliday({ date, name: name.trim() });
      setHolidays((p) => [...p, h].sort((a, b) => a.date.localeCompare(b.date)));
      setDate('');
      setName('');
      setError(null);
    } catch (e) {
      setError(msg(e));
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteHoliday(id);
      setHolidays((p) => p.filter((h) => h.id !== id));
    } catch (e) {
      setError(msg(e));
    }
  }

  return (
    <div className="card">
      <h3>祝日</h3>
      <p className="muted">
        日本の祝日カレンダーから年単位で自動取得できます(重複日はスキップ)。
      </p>
      <div className="inline-form" style={{ marginTop: 0 }}>
        <label>
          年:{' '}
          <input
            type="number"
            min={2000}
            max={2100}
            aria-label="取得する年"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ width: '6rem' }}
          />
        </label>
        <button type="button" onClick={importYear}>
          祝日を自動取得
        </button>
      </div>
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {holidays.length === 0 ? (
        <p className="muted">祝日が登録されていません。</p>
      ) : (
        <ul className="list-actionable">
          {holidays.map((h) => (
            <li key={h.id}>
              <span>
                {h.date.slice(0, 10)} <span className="muted">{h.name}</span>
              </span>
              <button type="button" className="btn-danger" onClick={() => remove(h.id)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="inline-form">
        <input type="date" aria-label="祝日の日付" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="text" placeholder="名称 (例: 元日)" aria-label="祝日の名称" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">祝日を登録</button>
      </form>
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
