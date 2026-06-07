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

  function reload() {
    if (!projectId) return;
    Promise.all([api.listRequirements(projectId), api.listTasks(projectId)])
      .then(([reqs, ts]) => {
        setRequirements(reqs);
        setTasks(ts);
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }

  useEffect(reload, [projectId]);

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

  // 要件から機能→標準工程(WBS)を展開 (US-013)
  async function expand(reqId: string) {
    try {
      await api.expandWbs(reqId);
      reload();
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  // 見積根拠(工数推定理由)を保存
  async function saveNote(taskId: string, note: string) {
    try {
      const updated = await api.updateTask(taskId, { estimateNote: note });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (e) {
      setError(toMessage(e));
    }
  }

  // レビュー自動展開 (US-014)
  async function expandReviews() {
    if (!projectId) return;
    try {
      await api.expandReviews(projectId);
      reload();
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  // 効率化調整(負の工数)を追加 (US-014)
  async function addEfficiency() {
    if (!projectId) return;
    const raw = window.prompt('効率化調整の工数(人日, 削減は負値。例: -1.0)');
    if (raw == null) return;
    const estimateDays = Number(raw);
    if (Number.isNaN(estimateDays)) {
      setError('数値を入力してください');
      return;
    }
    const note = window.prompt('削減の根拠(任意)') ?? undefined;
    try {
      await api.addEfficiency(projectId, { estimateDays, note });
      reload();
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
                <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button type="button" onClick={() => addTask(r.content, r.id)}>
                    タスク化
                  </button>
                  <button type="button" onClick={() => expand(r.id)}>
                    標準工程を展開
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted">
          「標準工程を展開」で機能の直下に 基本設計／詳細設計／コーディング／単体テスト／結合テスト を生成します。
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>WBS / タスク一覧</h3>
          <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" onClick={expandReviews} disabled={!projectId}>
              レビューを自動展開
            </button>
            <button type="button" onClick={addEfficiency} disabled={!projectId}>
              効率化調整を追加
            </button>
          </span>
        </div>
        {tasks.length === 0 ? (
          <p className="muted">タスクがありません。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>タスク</th>
                <th>工程</th>
                <th>見積根拠</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="muted">{t.wbsId ?? '—'}</td>
                  <td style={{ paddingLeft: `calc(${(t.level ?? 3) - 1} * var(--space-3))` }}>
                    {t.level === 1 ? <strong>{t.name}</strong> : t.name}
                    {t.kind === 'review' && <span className="badge badge-low"> レビュー</span>}
                    {t.kind === 'efficiency' && <span className="badge badge-medium"> 効率化</span>}
                  </td>
                  <td>{t.phase ?? ''}</td>
                  <td>
                    <input
                      type="text"
                      defaultValue={t.estimateNote ?? ''}
                      placeholder="工数推定理由"
                      aria-label={`${t.name} の見積根拠`}
                      onBlur={(e) => {
                        if (e.target.value !== (t.estimateNote ?? '')) saveNote(t.id, e.target.value);
                      }}
                      style={{ width: '100%' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
