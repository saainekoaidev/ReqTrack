import { useEffect, useState } from 'react';
import { api, type DelayItem, type DelayedMember, type Project } from '../api/client';

// 遅延ダッシュボード (US-009 遅れ検出 / US-010 遅れ要員)。
export default function DelaysPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [delays, setDelays] = useState<DelayItem[]>([]);
  const [delayedMembers, setDelayedMembers] = useState<DelayedMember[]>([]);
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
      .getDelays(projectId)
      .then(setDelays)
      .catch((e: unknown) => setError(toMessage(e)));
    api
      .getDelayedMembers(projectId)
      .then(setDelayedMembers)
      .catch((e: unknown) => setError(toMessage(e)));
  }, [projectId]);

  return (
    <section>
      <h2>遅延ダッシュボード</h2>
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
        <h3>遅延しているタスク</h3>
        {delays.length === 0 ? (
          <p className="muted">遅延しているタスクはありません。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>タスク</th>
                <th>担当</th>
                <th>計画(期待)</th>
                <th>実績</th>
                <th>遅れ</th>
              </tr>
            </thead>
            <tbody>
              {delays.map((d) => (
                <tr key={d.taskId}>
                  <td>{d.name}</td>
                  <td>{d.assigneeName ?? '—'}</td>
                  <td>{d.expectedProgress}%</td>
                  <td>{d.actualProgress}%</td>
                  <td className="error">▲ {d.behindBy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>遅れている要員</h3>
        {delayedMembers.length === 0 ? (
          <p className="muted">遅れている要員はいません。</p>
        ) : (
          <ul className="list-actionable">
            {delayedMembers.map((m) => (
              <li key={m.assigneeId}>
                <span>
                  {m.name}
                  <span className="muted">（遅延タスク {m.taskIds.length} 件）</span>
                </span>
                <span className="error">累計遅れ {m.totalBehind}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
