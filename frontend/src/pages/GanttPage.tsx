import { useEffect, useMemo, useState } from 'react';
import { api, type Member, type Task } from '../api/client';
import GanttChart, { type GanttPatch } from '../components/GanttChart';
import { overallProgress, workloadByAssignee } from '../lib/gantt';
import { useProject } from '../context/ProjectContext';

// ガントチャート画面 (US-004 / US-015 / US-046)。見積から初版を生成し可視化、左表でインライン編集。
export default function GanttPage() {
  const { projectId } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [holidays, setHolidays] = useState<ReadonlySet<string>>(new Set());
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [dayStartHour, setDayStartHour] = useState(9);
  const [startDate, setStartDate] = useState('2026-06-08');
  const [slip, setSlip] = useState(''); // イナズマ線の基準日(空なら非表示) (US-051)
  const [showToday, setShowToday] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overall = useMemo(() => overallProgress(tasks), [tasks]);
  const workload = useMemo(() => workloadByAssignee(tasks, hoursPerDay), [tasks, hoursPerDay]);

  useEffect(() => {
    api
      .listHolidays()
      .then((hs) => setHolidays(new Set(hs.map((h) => h.date.slice(0, 10)))))
      .catch(() => {});
    api
      .getSettings()
      .then((s) => {
        setHoursPerDay(s.hoursPerDay);
        setDayStartHour(s.dayStartHour);
      })
      .catch(() => {});
    api.listMembers().then(setMembers).catch(() => {});
  }, []);

  // ガント左表のインライン編集 (US-046)。保存即時、バーは「再生成」で反映。
  async function patchTask(taskId: string, data: GanttPatch) {
    try {
      const updated = await api.updateTask(taskId, data);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setMessage('変更を保存しました。「スケジュールを再生成」で日程に反映できます。');
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

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
        <p className="muted" style={{ marginTop: 0 }}>
          左の表で 名称・工数・稼働率・担当 を直接編集できます(保存即時)。日程へは「スケジュールを再生成」で反映。
          タスクの追加/削除は「WBS編集」で行います。
        </p>
        <div className="inline-form" style={{ marginTop: 0, marginBottom: 'var(--space-2)' }}>
          <label>
            <input type="checkbox" checked={showToday} onChange={(e) => setShowToday(e.target.checked)} />{' '}
            本日線
          </label>
          <label>
            イナズマ線の基準日:{' '}
            <input
              type="date"
              aria-label="イナズマ線の基準日"
              value={slip}
              onChange={(e) => setSlip(e.target.value)}
            />
          </label>
          {slip && (
            <button type="button" className="btn-secondary" onClick={() => setSlip('')}>
              イナズマ線を消す
            </button>
          )}
        </div>
        <GanttChart
          tasks={tasks}
          holidays={holidays}
          hoursPerDay={hoursPerDay}
          dayStartHour={dayStartHour}
          members={members}
          onPatch={patchTask}
          today={showToday ? nowWallClockUtc() : null}
          slipDate={slip ? new Date(`${slip}T00:00:00Z`) : null}
        />
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

// 本日線は「現在のウォールクロック」を UTC エンコードして渡す(workingTime は getUTC* を使うため)。
// これで時刻が進むと本日線も日の中を移動する (US-055)。
function nowWallClockUtc(): Date {
  const n = new Date();
  return new Date(
    Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes()),
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
