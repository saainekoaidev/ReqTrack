import { useEffect, useMemo, useState } from 'react';
import { api, type Project, type Task } from '../api/client';

// 見積画面 (US-003)。洗い出したタスクに工数(人日)の見積を設定する。
export default function EstimatePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
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
    api
      .listTasks(projectId)
      .then((ts) => {
        setTasks(ts);
        setDrafts(Object.fromEntries(ts.map((t) => [t.id, String(t.estimateDays)])));
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }, [projectId]);

  const total = useMemo(
    () => tasks.reduce((sum, t) => sum + (t.estimateDays || 0), 0),
    [tasks],
  );

  async function save(taskId: string) {
    const raw = drafts[taskId] ?? '0';
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0) {
      setError('見積は 0 以上の数値を入力してください');
      return;
    }
    try {
      const updated = await api.updateTask(taskId, { estimateDays: value });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  return (
    <section>
      <h2>見積</h2>
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
        <h3>タスク見積</h3>
        {tasks.length === 0 ? (
          <p className="muted">タスクがありません。「タスク」画面で先に洗い出してください。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>タスク</th>
                <th>見積(人日)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      aria-label={`${t.name} の見積`}
                      value={drafts[t.id] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                      style={{ width: '6rem' }}
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => save(t.id)}>
                      保存
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>合計</th>
                <td colSpan={2}>{total} 人日</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
