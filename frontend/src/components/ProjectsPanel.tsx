import { useEffect, useState } from 'react';
import { api, type Project } from '../api/client';

// プロジェクト管理パネル (US-030)。一覧と削除(確認つき)。
export default function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function reload() {
    api.listProjects().then(setProjects).catch((e: unknown) => setError(msg(e)));
  }
  useEffect(reload, []);

  async function remove(p: Project) {
    if (
      !window.confirm(
        `「${p.name}」を削除しますか?\n配下の要件・タスク・日報も一緒に削除されます(取り消せません)。`,
      )
    )
      return;
    try {
      await api.deleteProject(p.id);
      setMessage(`「${p.name}」を削除しました。`);
      setError(null);
      reload();
    } catch (e) {
      setError(msg(e));
    }
  }

  return (
    <div className="card">
      <h3>プロジェクト</h3>
      <p className="muted">不要になったプロジェクトを削除できます(配下データも連動削除)。</p>
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
      {projects.length === 0 ? (
        <p className="muted">プロジェクトがありません。</p>
      ) : (
        <ul className="list-actionable">
          {projects.map((p) => (
            <li key={p.id}>
              <span>
                {p.name}
                {p.description ? <span className="muted"> {p.description}</span> : null}
              </span>
              <button type="button" className="btn-danger" onClick={() => remove(p)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
