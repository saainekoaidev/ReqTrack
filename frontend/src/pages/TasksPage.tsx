import { useEffect, useState, type FormEvent } from 'react';
import { api, type Project, type Requirement, type Task } from '../api/client';

// タスク洗い出し画面 (US-002)。要件からタスク・工程を洗い出して登録する。
export default function TasksPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [name, setName] = useState('');
  const [requirementId, setRequirementId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((ps) => {
        setProjects(ps);
        if (ps[0]) setProjectId(ps[0].id);
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([api.listRequirements(projectId), api.listTasks(projectId)])
      .then(([reqs, ts]) => {
        setRequirements(reqs);
        setTasks(ts);
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }, [projectId]);

  async function addTask(taskName: string, reqId?: string) {
    if (!taskName.trim() || !projectId) return;
    try {
      const t = await api.createTask({ projectId, name: taskName.trim(), requirementId: reqId });
      setTasks((prev) => [...prev, t]);
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await addTask(name, requirementId || undefined);
    setName('');
    setRequirementId('');
  }

  return (
    <section>
      <h2>タスク洗い出し</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="card">
        <label>
          対象プロジェクト:{' '}
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.length === 0 && <option value="">(プロジェクトなし)</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <h3>要件からタスクを洗い出す</h3>
        {requirements.length === 0 ? (
          <p className="muted">要件がありません。「要件」画面で先に登録してください。</p>
        ) : (
          <ul className="list-actionable">
            {requirements.map((r) => (
              <li key={r.id}>
                <span>{r.content}</span>
                <button type="button" onClick={() => addTask(r.content, r.id)}>
                  タスク化
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>タスク一覧</h3>
        {tasks.length === 0 ? (
          <p className="muted">タスクがありません。</p>
        ) : (
          <ul>
            {tasks.map((t) => (
              <li key={t.id}>
                {t.name}
                {t.requirement ? <span className="muted">（要件: {t.requirement.content}）</span> : null}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleSubmit} className="inline-form">
          <input
            type="text"
            placeholder="タスク名を直接入力"
            aria-label="タスク名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!projectId}
          />
          <select
            aria-label="紐づける要件"
            value={requirementId}
            onChange={(e) => setRequirementId(e.target.value)}
          >
            <option value="">(要件に紐づけない)</option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.content}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!projectId}>
            タスク追加
          </button>
        </form>
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
