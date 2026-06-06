import { useEffect, useState, type FormEvent } from 'react';
import { api, type Project, type Requirement } from '../api/client';

// 要件入力画面 (US-001)。プロジェクトを選び、要件を受け取り登録する。
export default function RequirementsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [content, setContent] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // プロジェクト一覧の取得
  useEffect(() => {
    api
      .listProjects()
      .then((ps) => {
        setProjects(ps);
        if (ps.length > 0 && ps[0]) setProjectId(ps[0].id);
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }, []);

  // 選択プロジェクトの要件取得
  useEffect(() => {
    if (!projectId) {
      setRequirements([]);
      return;
    }
    api
      .listRequirements(projectId)
      .then(setRequirements)
      .catch((e: unknown) => setError(toMessage(e)));
  }, [projectId]);

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const p = await api.createProject({ name: newProjectName.trim() });
      setProjects((prev) => [p, ...prev]);
      setProjectId(p.id);
      setNewProjectName('');
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function handleAddRequirement(e: FormEvent) {
    e.preventDefault();
    if (!content.trim() || !projectId) return;
    try {
      const r = await api.createRequirement({ projectId, content: content.trim() });
      setRequirements((prev) => [...prev, r]);
      setContent('');
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  return (
    <section>
      <h2>要件</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="card">
        <h3>プロジェクト</h3>
        {projects.length > 0 ? (
          <label>
            対象プロジェクト:{' '}
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted">プロジェクトがありません。まず作成してください。</p>
        )}
        <form onSubmit={handleCreateProject} className="inline-form">
          <input
            type="text"
            placeholder="新規プロジェクト名"
            aria-label="新規プロジェクト名"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <button type="submit">プロジェクト作成</button>
        </form>
      </div>

      <div className="card">
        <h3>要件一覧</h3>
        {requirements.length === 0 ? (
          <p className="muted">要件が登録されていません。</p>
        ) : (
          <ol>
            {requirements.map((r) => (
              <li key={r.id}>{r.content}</li>
            ))}
          </ol>
        )}
        <form onSubmit={handleAddRequirement} className="inline-form">
          <input
            type="text"
            placeholder="要件を入力 (例: ログイン機能が欲しい)"
            aria-label="要件内容"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!projectId}
          />
          <button type="submit" disabled={!projectId}>
            要件を追加
          </button>
        </form>
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
