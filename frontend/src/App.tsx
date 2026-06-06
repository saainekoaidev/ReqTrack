import { useEffect, useState } from 'react';
import { api, type Member } from './api/client';

// 初期構成の動作確認用トップ画面。要員一覧(US-005)を backend から取得して表示する。
export default function App() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listMembers()
      .then(setMembers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="app-header">
        <h1>ReqTrack</h1>
      </header>
      <main className="app-main">
        <section className="card">
          <h2>要員一覧</h2>
          {loading && <p className="muted">読み込み中…</p>}
          {error && (
            <p className="error" role="alert">
              API に接続できません: {error}
            </p>
          )}
          {!loading && !error && members.length === 0 && (
            <p className="muted">要員が登録されていません。</p>
          )}
          {members.length > 0 && (
            <ul>
              {members.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.role ? `（${m.role}）` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
