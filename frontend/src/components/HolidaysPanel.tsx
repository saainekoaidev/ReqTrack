import { useEffect, useState, type FormEvent } from 'react';
import { api, type Holiday } from '../api/client';

// 祝日登録パネル (US-006 / 設定タブ US-022)。
export default function HolidaysPanel() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listHolidays().then(setHolidays).catch((e: unknown) => setError(msg(e)));
  }, []);

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
