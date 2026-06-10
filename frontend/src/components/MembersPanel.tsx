import { useEffect, useState, type FormEvent } from 'react';
import { api, type Member } from '../api/client';
import { ROLE_OPTIONS, roleLabel } from '../lib/roles';

// 要員登録パネル (US-005 / 設定タブ US-022 / 役割 US-043)。
export default function MembersPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('member');
  const [email, setEmail] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listMembers().then(setMembers).catch((e: unknown) => setError(msg(e)));
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const m = await api.createMember({
        name: name.trim(),
        role: role || undefined,
        email: email.trim() || undefined,
        hourlyRate: rate.trim() ? Number(rate) : undefined,
      });
      setMembers((p) => [...p, m]);
      setName('');
      setRole('member');
      setEmail('');
      setRate('');
      setError(null);
    } catch (e) {
      setError(msg(e));
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteMember(id);
      setMembers((p) => p.filter((m) => m.id !== id));
    } catch (e) {
      setError(msg(e));
    }
  }

  return (
    <div className="card">
      <h3>要員</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {members.length === 0 ? (
        <p className="muted">要員が登録されていません。</p>
      ) : (
        <ul className="list-actionable">
          {members.map((m) => (
            <li key={m.id}>
              <span>
                {m.name}
                <span className="muted">（{roleLabel(m.role)}）</span>
                {m.email ? <span className="muted"> {m.email}</span> : null}
                {m.hourlyRate != null ? (
                  <span className="muted"> {m.hourlyRate.toLocaleString()} 円/時</span>
                ) : null}
              </span>
              <button type="button" className="btn-danger" onClick={() => remove(m.id)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="inline-form">
        <input type="text" placeholder="氏名" aria-label="要員氏名" value={name} onChange={(e) => setName(e.target.value)} />
        <select aria-label="役割" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input type="email" placeholder="メール (任意)" aria-label="メール" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="number" min={0} step={100} placeholder="単価 円/時 (任意)" aria-label="単価(円/時)" value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: '9rem' }} />
        <button type="submit">要員を登録</button>
      </form>
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
