import { useEffect, useState, type FormEvent } from 'react';
import { api, type Member } from '../api/client';

// マスタ登録画面 (US-005 要員 / US-006 祝日)。本 US では要員セクションを実装する。
export default function MastersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMembers()
      .then(setMembers)
      .catch((e: unknown) => setError(toMessage(e)));
  }, []);

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
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
