import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Member, type Task } from '../api/client';
import { useCreate } from '../context/CreateContext';
import { sortTasksByWbs, nextFeatureWbsId, nextChildWbsId } from '../lib/wbs';

// WBS 編集(手組み, US-018 / US-038)。作成中プロジェクトに階層タスクを直接 追加・編集し、ガントを生成する。
export default function WbsEditPage() {
  const { draft, loaded, clearDraft } = useCreate();
  const navigate = useNavigate();
  const projectId = draft?.id ?? '';
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [minStep, setMinStep] = useState(0.1);
  const [startDate, setStartDate] = useState('2026-06-08');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listMembers().then(setMembers).catch(() => {});
    api.getSettings().then((s) => setMinStep(s.minEstimateDays)).catch(() => {});
  }, []);

  function reload() {
    if (!projectId) return;
    api.listTasks(projectId).then(setTasks).catch((e: unknown) => setError(toMessage(e)));
  }
  useEffect(reload, [projectId]);

  async function generateAndGo() {
    if (!projectId) return;
    try {
      await api.generateSchedule(projectId, startDate);
      localStorage.setItem('reqtrack.projectId', projectId);
      clearDraft();
      navigate('/manage/gantt');
    } catch (e) {
      setError(toMessage(e));
    }
  }

  const ordered = sortTasksByWbs(tasks);

  async function addFeature() {
    if (!projectId) return;
    try {
      await api.createTask({
        projectId,
        name: '新しい機能',
        level: 1,
        wbsId: nextFeatureWbsId(tasks),
      });
      reload();
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function addChild(parent: Task) {
    if (!projectId) return;
    const level = Math.min(3, (parent.level ?? 1) + 1);
    try {
      await api.createTask({
        projectId,
        name: '新しいタスク',
        level,
        parentId: parent.id,
        wbsId: nextChildWbsId(parent, tasks),
      });
      reload();
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function remove(t: Task) {
    if (!window.confirm(`「${t.name}」を削除しますか?(子タスクも削除されます)`)) return;
    try {
      await api.deleteTask(t.id);
      reload();
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function patch(t: Task, patchData: Parameters<typeof api.updateTask>[1]) {
    try {
      const updated = await api.updateTask(t.id, patchData);
      setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
      setError(null);
    } catch (e) {
      setError(toMessage(e));
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
        <div className="inline-form" style={{ marginTop: 0, justifyContent: 'space-between' }}>
          <span className="muted">
            対象プロジェクト: <strong>{draft.name}</strong>
          </span>
          <button type="button" onClick={addFeature}>
            機能を追加
          </button>
        </div>
      </div>

      <div className="card">
        {ordered.length === 0 ? (
          <p className="muted">タスクがありません。「機能を追加」から組み立ててください。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>タスク名</th>
                <th>工程</th>
                <th>工数</th>
                <th>稼働率</th>
                <th>担当</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((t) => (
                <tr key={t.id}>
                  <td className="muted">{t.wbsId ?? '—'}</td>
                  <td style={{ paddingLeft: `calc(${(t.level ?? 3) - 1} * var(--space-3))` }}>
                    <input
                      type="text"
                      aria-label={`${t.wbsId ?? t.id} の名称`}
                      defaultValue={t.name}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== t.name)
                          patch(t, { name: e.target.value.trim() });
                      }}
                      style={{ width: '100%', fontWeight: t.level === 1 ? 600 : 400 }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label={`${t.wbsId ?? t.id} の工程`}
                      defaultValue={t.phase ?? ''}
                      onBlur={(e) => {
                        if (e.target.value !== (t.phase ?? '')) patch(t, { phase: e.target.value || null });
                      }}
                      style={{ width: '7rem' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={minStep}
                      aria-label={`${t.wbsId ?? t.id} の工数`}
                      defaultValue={t.estimateDays}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v !== t.estimateDays) patch(t, { estimateDays: v });
                      }}
                      style={{ width: '5rem' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0.05}
                      max={1}
                      step={0.05}
                      aria-label={`${t.wbsId ?? t.id} の稼働率`}
                      defaultValue={t.utilizationRate ?? 1}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v > 0 && v <= 1 && v !== t.utilizationRate)
                          patch(t, { utilizationRate: v });
                      }}
                      style={{ width: '4.5rem' }}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`${t.wbsId ?? t.id} の担当`}
                      value={t.assigneeId ?? ''}
                      onChange={(e) => patch(t, { assigneeId: e.target.value || null })}
                    >
                      <option value="">(未割当)</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {(t.level ?? 3) < 3 && (
                      <button type="button" className="btn-link-plain" onClick={() => addChild(t)}>
                        子追加
                      </button>
                    )}{' '}
                    <button type="button" className="btn-link-plain" onClick={() => remove(t)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
          <button type="button" onClick={generateAndGo} disabled={ordered.length === 0}>
            ガントを生成して進捗管理へ →
          </button>
        </div>
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
