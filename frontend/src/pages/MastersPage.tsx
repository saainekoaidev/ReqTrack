import { useEffect, useState, type FormEvent } from 'react';
import { api, type Member, type Holiday } from '../api/client';

// マスタ登録画面 (US-005 要員 / US-006 祝日)。
export default function MastersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMembers()
      .then(setMembers)
      .catch((e: unknown) => setError(toMessage(e)));
    api
      .listHolidays()
      .then(setHolidays)
      .catch((e: unknown) => setError(toMessage(e)));
  }, []);

  async function addHoliday(e: FormEvent) {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) return;
    try {
      const h = await api.createHoliday({ date: holidayDate, name: holidayName.trim() });
      setHolidays((prev) => [...prev, h].sort((a, b) => a.date.localeCompare(b.date)));
      setHolidayDate('');
      setHolidayName('');
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function removeHoliday(id: string) {
    try {
      await api.deleteHoliday(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const m = await api.createMember({
        name: name.trim(),
        role: role.trim() || undefined,
        email: email.trim() || undefined,
      });
      setMembers((prev) => [...prev, m]);
      setName('');
      setRole('');
      setEmail('');
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function removeMember(id: string) {
    try {
      await api.deleteMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(toMessage(e));
    }
  }

  return (
    <section>
      <h2>マスタ登録</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="card">
        <h3>要員</h3>
        {members.length === 0 ? (
          <p className="muted">要員が登録されていません。</p>
        ) : (
          <ul className="list-actionable">
            {members.map((m) => (
              <li key={m.id}>
                <span>
                  {m.name}
                  {m.role ? `（${m.role}）` : ''}
                  {m.email ? <span className="muted"> {m.email}</span> : null}
                </span>
                <button type="button" className="btn-danger" onClick={() => removeMember(m.id)}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addMember} className="inline-form">
          <input
            type="text"
            placeholder="氏名"
            aria-label="要員氏名"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            placeholder="役割 (任意)"
            aria-label="役割"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <input
            type="email"
            placeholder="メール (任意)"
            aria-label="メール"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">要員を登録</button>
        </form>
      </div>

      <div className="card">
        <h3>祝日</h3>
        {holidays.length === 0 ? (
          <p className="muted">祝日が登録されていません。</p>
        ) : (
          <ul className="list-actionable">
            {holidays.map((h) => (
              <li key={h.id}>
                <span>
                  {h.date.slice(0, 10)} <span className="muted">{h.name}</span>
                </span>
                <button type="button" className="btn-danger" onClick={() => removeHoliday(h.id)}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addHoliday} className="inline-form">
          <input
            type="date"
            aria-label="祝日の日付"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
          />
          <input
            type="text"
            placeholder="名称 (例: 元日)"
            aria-label="祝日の名称"
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
          />
          <button type="submit">祝日を登録</button>
        </form>
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
