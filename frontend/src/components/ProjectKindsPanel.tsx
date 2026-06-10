import { useEffect, useState, type FormEvent } from 'react';
import { api, type EstimateTemplate, type ProjectKind } from '../api/client';

// 案件区分マスタ + 見積テンプレート (US-060)。設定タブ。
export default function ProjectKindsPanel() {
  const [kinds, setKinds] = useState<ProjectKind[]>([]);
  const [templates, setTemplates] = useState<EstimateTemplate[]>([]);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [requiresRef, setRequiresRef] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listProjectKinds().then(setKinds).catch((e: unknown) => setError(msg(e)));
    api.listTemplates().then(setTemplates).catch(() => {});
  }
  useEffect(reload, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createProjectKind({
        name: name.trim(),
        note: note.trim() || undefined,
        requiresReference: requiresRef,
        sortOrder: (kinds[kinds.length - 1]?.sortOrder ?? 0) + 1,
      });
      setName('');
      setNote('');
      setRequiresRef(false);
      setError(null);
      reload();
    } catch (e) {
      setError(msg(e));
    }
  }

  async function removeKind(id: string) {
    if (!window.confirm('この案件区分を削除しますか?')) return;
    try {
      await api.deleteProjectKind(id);
      reload();
    } catch (e) {
      setError(msg(e));
    }
  }

  async function removeTemplate(id: string) {
    if (!window.confirm('このテンプレートを削除しますか?')) return;
    try {
      await api.deleteTemplate(id);
      reload();
    } catch (e) {
      setError(msg(e));
    }
  }

  async function toggleRef(k: ProjectKind) {
    try {
      await api.updateProjectKind(k.id, {
        name: k.name,
        note: k.note ?? undefined,
        requiresReference: !k.requiresReference,
        sortOrder: k.sortOrder,
      });
      reload();
    } catch (e) {
      setError(msg(e));
    }
  }

  return (
    <div className="card">
      <h3>案件区分</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="muted" style={{ marginTop: 0 }}>
        新規作成時に選べる案件区分です。「参照資料を要する」をオンにすると、その区分では参照資料の選択が必須になり、AI見積で資料を参照します。
      </p>
      {kinds.length === 0 ? (
        <p className="muted">案件区分がありません。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>説明</th>
              <th>参照資料</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className="muted">{k.note}</td>
                <td>
                  <label>
                    <input type="checkbox" checked={k.requiresReference} onChange={() => toggleRef(k)} /> 要
                  </label>
                </td>
                <td>
                  <button type="button" className="btn-link-plain" onClick={() => removeKind(k.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={add} className="inline-form">
        <input type="text" placeholder="区分名 (例: 保守運用)" aria-label="区分名" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="text" placeholder="説明 (任意)" aria-label="区分の説明" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '18rem' }} />
        <label>
          <input type="checkbox" checked={requiresRef} onChange={(e) => setRequiresRef(e.target.checked)} /> 参照資料を要する
        </label>
        <button type="submit">区分を追加</button>
      </form>

      <h3 style={{ marginTop: 'var(--space-4)' }}>見積テンプレート</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        新規作成の「見積・ガント」で適用できる定型のWBSです。テンプレートは見積画面の「このWBSをテンプレ保存」で作成できます。
      </p>
      {templates.length === 0 ? (
        <p className="muted">テンプレートがありません。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>対象区分</th>
              <th>項目数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="muted">{t.projectKind ?? '—'}</td>
                <td>{t.itemCount}</td>
                <td>
                  <button type="button" className="btn-link-plain" onClick={() => removeTemplate(t.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
