import { useEffect, useState } from 'react';
import { api, type Member, type Project, type Task } from '../api/client';

// 進捗報告画面 (US-007)。要員がタスクの進捗率を報告し、タスクへ反映する (→ US-008)。
export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { memberId: string; progress: string }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((ps) => {
        setProjects(ps);
        if (ps[0]) setProjectId(ps[0].id);
      })
      .catch((e: unknown) => setError(toMessage(e)));
    api
      .listMembers()
      .then(setMembers)
      .catch((e: unknown) => setError(toMessage(e)));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api
      .listTasks(projectId)
      .then((ts) => {
        setTasks(ts);
        setDrafts(
          Object.fromEntries(
            ts.map((t) => [t.id, { memberId: t.assigneeId ?? '', progress: String(t.progress) }]),
          ),
        );
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }, [projectId]);

  async function submit(task: Task) {
    const draft = drafts[task.id];
    if (!draft) return;
    if (!draft.memberId) {
      setError('報告者(要員)を選択してください');
      return;
    }
    const progress = Number(draft.progress);
    if (Number.isNaN(progress) || progress < 0 || progress > 100) {
      setError('進捗率は 0〜100 で入力してください');
      return;
    }
    try {
      await api.addReport(task.id, { memberId: draft.memberId, progress });
      // タスクの進捗率へ反映 (US-008)
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, progress } : t)));
      setMessage(`「${task.name}」の進捗を ${progress}% として報告しました`);
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  return (
    <section>
      <h2>進捗報告</h2>
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
        <h3>タスクの進捗報告</h3>
        {tasks.length === 0 ? (
          <p className="muted">タスクがありません。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>タスク</th>
                <th>現在</th>
                <th>報告者</th>
                <th>進捗率(%)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.progress}%</td>
                  <td>
                    <select
                      aria-label={`${t.name} の報告者`}
                      value={drafts[t.id]?.memberId ?? ''}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [t.id]: { ...(d[t.id] ?? { progress: '0' }), memberId: e.target.value },
                        }))
                      }
                    >
                      <option value="">(選択)</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      aria-label={`${t.name} の進捗率`}
                      value={drafts[t.id]?.progress ?? ''}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [t.id]: { ...(d[t.id] ?? { memberId: '' }), progress: e.target.value },
                        }))
                      }
                      style={{ width: '5rem' }}
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => submit(t)}>
                      報告
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
