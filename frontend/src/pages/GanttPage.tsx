import { useEffect, useMemo, useState } from 'react';
import { api, type Project, type Task } from '../api/client';
import GanttChart from '../components/GanttChart';
import { overallProgress, workloadByAssignee } from '../lib/gantt';

// ガントチャート画面 (US-004 / US-015)。見積から初版を生成し、ce2 準拠の列で可視化する。
export default function GanttPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [holidays, setHolidays] = useState<ReadonlySet<string>>(new Set());
  const [startDate, setStartDate] = useState('2026-06-08');
  const [error, setError] = useState<string | null>(null);

  const overall = useMemo(() => overallProgress(tasks), [tasks]);
  const workload = useMemo(() => workloadByAssignee(tasks), [tasks]);

  useEffect(() => {
    api
      .listProjects()
      .then((ps) => {
        setProjects(ps);
        if (ps[0]) setProjectId(ps[0].id);
      })
      .catch((e: unknown) => setError(toMessage(e)));
    api
      .listHolidays()
      .then((hs) => setHolidays(new Set(hs.map((h) => h.date.slice(0, 10)))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api
      .listTasks(projectId)
      .then(setTasks)
      .catch((e: unknown) => setError(toMessage(e)));
  }, [projectId]);

  async function generate() {
    if (!projectId) return;
    try {
      const updated = await api.generateSchedule(projectId, startDate);
      setTasks(updated);
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  return (
    <section>
      <h2>ガントチャート</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="card">
        <div className="inline-form" style={{ marginTop: 0 }}>
          <label>
            プロジェクト:{' '}
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.length === 0 && <option value="">(プロジェクトなし)</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            開始日:{' '}
            <input
              type="date"
              aria-label="開始日"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <button type="button" onClick={generate} disabled={!projectId}>
            ガント初版を生成
          </button>
          {projectId && (
            <a className="btn-link" href={api.estimateXlsxUrl(projectId)}>
              見積Excelをダウンロード
            </a>
          )}
        </div>
        <p className="muted" style={{ marginTop: 'var(--space-2)' }}>
          見積(人日)をもとに、土日・祝日を除いた稼働日でタスクを直列に割り付けます。
        </p>
      </div>

      {tasks.length > 0 && (
        <div className="card">
          <h3>全体進捗</h3>
          <div className="progress-summary">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${overall}%` }} />
            </div>
            <strong aria-label="全体進捗率">{overall}%</strong>
          </div>
          <p className="muted">進捗報告(US-007)を見積で加重平均した全体進捗です。</p>
        </div>
      )}

      <div className="card gantt-card">
        <GanttChart tasks={tasks} holidays={holidays} />
      </div>

      {workload.length > 0 && (
        <div className="card">
          <h3>担当者別工数</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>担当者</th>
                <th>工数(人日)</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((w) => (
                <tr key={w.name}>
                  <td>{w.name}</td>
                  <td>{w.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
