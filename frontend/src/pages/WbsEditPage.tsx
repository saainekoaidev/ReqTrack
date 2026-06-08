import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Task } from '../api/client';
import { useCreate } from '../context/CreateContext';
import WbsEditor from '../components/WbsEditor';

// WBS 編集(手組み, 新規作成フロー US-018 / US-038 / US-041)。
// 作成中プロジェクトに階層タスクを直接 組み立て、ガントを生成する。
export default function WbsEditPage() {
  const { draft, loaded, clearDraft } = useCreate();
  const navigate = useNavigate();
  const projectId = draft?.id ?? '';
  const [taskCount, setTaskCount] = useState(0);
  const [startDate, setStartDate] = useState('2026-06-08');
  const [error, setError] = useState<string | null>(null);

  async function generateAndGo() {
    if (!projectId) return;
    try {
      await api.generateSchedule(projectId, startDate);
      localStorage.setItem('reqtrack.projectId', projectId);
      clearDraft();
      navigate('/manage/gantt');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!loaded) return null;

  if (!draft) {
    return (
      <section>
        <h2>WBS 編集(手組み)</h2>
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            先にプロジェクトを作成してください。
          </p>
          <button type="button" onClick={() => navigate('/create')}>
            ← プロジェクト作成へ
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2>WBS 編集(手組み)</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          対象プロジェクト: <strong>{draft.name}</strong>
        </p>
        <WbsEditor projectId={projectId} onChange={(ts: Task[]) => setTaskCount(ts.length)} />
      </div>

      <div className="card">
        <h3>ガントを生成</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          工数・稼働率から、土日・祝日を除いた稼働日でタスクを割り付け、ガントを作成します。
        </p>
        <div className="inline-form" style={{ marginTop: 0 }}>
          <button type="button" className="btn-secondary" onClick={() => navigate('/create/estimate')}>
            ← 見積・ガント へ戻る
          </button>
          <label>
            開始日:{' '}
            <input
              type="date"
              aria-label="開始日"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <button type="button" onClick={generateAndGo} disabled={taskCount === 0}>
            ガントを生成して進捗管理へ →
          </button>
        </div>
      </div>
    </section>
  );
}
