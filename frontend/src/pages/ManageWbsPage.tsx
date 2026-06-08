import { useState } from 'react';
import { api, type Task } from '../api/client';
import { useProject } from '../context/ProjectContext';
import WbsEditor from '../components/WbsEditor';

// 進捗管理 > WBS編集 (US-041)。実行中にタスクの追加/削除/変更・工数/稼働率/担当を編集し、
// 「スケジュール再生成」で日程へ反映する。
export default function ManageWbsPage() {
  const { projectId, reload: reloadProjects } = useProject();
  const [startDate, setStartDate] = useState('');
  const [startTouched, setStartTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // タスクの最小開始日を再生成の既定開始日にする
  function onTasks(tasks: Task[]) {
    if (startTouched) return;
    const starts = tasks.map((t) => t.plannedStart).filter(Boolean) as string[];
    if (starts.length > 0) {
      const min = starts.reduce((a, b) => (a < b ? a : b));
      setStartDate(min.slice(0, 10));
    }
  }

  async function regenerate() {
    if (!projectId) return;
    const sd = startDate || new Date().toISOString().slice(0, 10);
    try {
      const updated = await api.generateSchedule(projectId, sd);
      const scheduled = updated.filter((t) => t.plannedStart).length;
      setMessage(
        `スケジュールを再生成しました(${scheduled} 件を配置)。ガントで確認できます。`,
      );
      setError(null);
      reloadProjects();
    } catch (e) {
      setMessage(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!projectId) {
    return (
      <section>
        <h2>WBS 編集</h2>
        <p className="muted">対象プロジェクトを選択してください。</p>
      </section>
    );
  }

  return (
    <section>
      <h2>WBS 編集</h2>
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
        <p className="muted" style={{ marginTop: 0 }}>
          実行中のタスク追加/削除/変更、工数・稼働率・担当の変更ができます。変更後に下の「スケジュール再生成」で日程へ反映してください。
          要員の追加/削減は <strong>設定 &gt; 要員</strong> で行います。
        </p>
        <WbsEditor projectId={projectId} onChange={onTasks} />
      </div>

      <div className="card">
        <h3>スケジュール再生成</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          開始日を起点に、同じ対象配下は工程順に直列、同じ担当は直列(別担当は並行)で全タスクを割り付け直します。
        </p>
        <div className="inline-form" style={{ marginTop: 0 }}>
          <label>
            開始日:{' '}
            <input
              type="date"
              aria-label="開始日"
              value={startDate}
              onChange={(e) => {
                setStartTouched(true);
                setStartDate(e.target.value);
              }}
            />
          </label>
          <button type="button" onClick={regenerate}>
            スケジュールを再生成
          </button>
        </div>
      </div>
    </section>
  );
}
