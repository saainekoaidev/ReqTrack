import { useEffect, useMemo, useState } from 'react';
import { api, type Task } from '../api/client';
import GanttChart from '../components/GanttChart';
import { overallProgress, workloadByAssignee } from '../lib/gantt';
import { useProject } from '../context/ProjectContext';

// ガントチャート画面 (US-004 / US-015)。見積から初版を生成し、ce2 準拠の列で可視化する。
export default function GanttPage() {
  const { projectId } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [holidays, setHolidays] = useState<ReadonlySet<string>>(new Set());
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [startDate, setStartDate] = useState('2026-06-08');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overall = useMemo(() => overallProgress(tasks), [tasks]);
  const workload = useMemo(() => workloadByAssignee(tasks, hoursPerDay), [tasks, hoursPerDay]);

  useEffect(() => {
    api
      .listHolidays()
      .then((hs) => setHolidays(new Set(hs.map((h) => h.date.slice(0, 10)))))
      .catch(() => {});
    api.getSettings().then((s) => setHoursPerDay(s.hoursPerDay)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    api
      .listTasks(projectId)
      .then(setTasks)
      .catch((e: unknown) => setError(toMessage(e)));
  }, [projectId]);

  async function regenerate() {
    if (!projectId) return;
    try {
      const updated = await api.generateSchedule(projectId, startDate);
      setTasks(updated);
      const scheduled = updated.filter((t) => t.plannedStart).length;
      setMessage(
        scheduled > 0
          ? `スケジュールを再生成しました(${scheduled} 件のタスクを配置)。`
          : '配置対象のタスクがありません。工数(人日)が 0 より大きいタスクが必要です(見積を入力してください)。',
      );
      setError(null);
    } catch (e) {
      setMessage(null);
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
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}

      <div className="card">
        <div className="inline-form" style={{ marginTop: 0 }}>
          <label>
            開始日:{' '}
            <input
              type="date"
              aria-label="開始日"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <button type="button" onClick={regenerate} disabled={!projectId}>
            スケジュールを再生成
          </button>
          {projectId && (
            <a className="btn-link" href={api.estimateXlsxUrl(projectId)}>
              見積Excelをダウンロード
            </a>
          )}
        </div>
        <p className="muted" style={{ marginTop: 'var(--space-2)' }}>
          見積(人日)と稼働率をもとに、土日・祝日を除いた稼働日でタスクを割り付け直します。初版は新規作成の「見積」で生成されます。
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
          <p className="muted">進捗報告を見積で加重平均した全体進捗です。</p>
        </div>
      )}

      <div className="card">
        <GanttChart tasks={tasks} holidays={holidays} hoursPerDay={hoursPerDay} />
      </div>

      {workload.length > 0 && (
        <div className="card">
          <h3>担当者別工数・工賃</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>担当者</th>
                <th>工数(人日)</th>
                <th>工賃概算(円)</th>
              </tr>
            </thead>
            <tbody>
              {workload.map((w) => (
                <tr key={w.name}>
                  <td>{w.name}</td>
                  <td>{w.days}</td>
                  <td>{w.cost != null ? w.cost.toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">工賃概算 = 工数(人日) × 1日の作業時間({hoursPerDay}h) × 単価(設定&gt;要員)。</p>
        </div>
      )}
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
