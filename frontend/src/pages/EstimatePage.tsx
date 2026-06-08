import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Task } from '../api/client';
import { useCreate } from '../context/CreateContext';
import { effortHours, spanWorkingDays, round3 } from '../lib/estimate';

// 3. 見積・ガント生成 (US-036 / US-037 / US-038)。
// 起点を選び(AIガント/AI見積/手組み)、WBS はこの選択後に生成する。見積調整とガント生成もここ。
type Draft = { estimate: string; util: string };

export default function EstimatePage() {
  const { draft, loaded, clearDraft } = useCreate();
  const navigate = useNavigate();
  const projectId = draft?.id ?? '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [minStep, setMinStep] = useState(0.1);
  const [startDate, setStartDate] = useState('2026-06-08');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => setMinStep(s.minEstimateDays)).catch(() => {});
  }, []);

  function loadTasks() {
    if (!projectId) return;
    api
      .listTasks(projectId)
      .then((ts) => {
        setTasks(ts);
        setDrafts(
          Object.fromEntries(
            ts.map((t) => [
              t.id,
              { estimate: String(t.estimateDays), util: String(t.utilizationRate ?? 1) },
            ]),
          ),
        );
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }
  useEffect(loadTasks, [projectId]);

  const total = useMemo(
    () => round3(tasks.reduce((sum, t) => sum + (t.estimateDays || 0), 0)),
    [tasks],
  );

  function finishToGantt() {
    if (projectId) localStorage.setItem('reqtrack.projectId', projectId);
    clearDraft();
    navigate('/manage/gantt');
  }

  // 要件 → AI見積 → スケジュール割付 を一気通貫で実行しガントへ (US-037)
  async function aiPlanAndGo() {
    if (!projectId) return;
    setMessage('AI で要件から見積・スケジュールを生成中です(数十秒かかることがあります)…');
    try {
      const r = await api.aiPlan(projectId, startDate);
      setMessage(
        `AI で生成しました: 機能 ${r.features} 件 / タスク ${r.tasks} 件 / 計画済み ${r.scheduled} 件。ガントへ移動します。`,
      );
      setError(null);
      finishToGantt();
    } catch (e) {
      setMessage(null);
      setError(toMessage(e));
    }
  }

  // AI で見積だけ生成(後で調整) (US-036)
  async function aiEstimateOnly() {
    if (!projectId) return;
    setMessage('AI で見積を生成中です(数十秒かかることがあります)…');
    try {
      const r = await api.aiEstimate(projectId);
      setMessage(`AI 見積を生成しました: 機能 ${r.features} 件 / タスク ${r.tasks} 件。下の表で調整できます。`);
      setError(null);
      loadTasks();
    } catch (e) {
      setMessage(null);
      setError(toMessage(e));
    }
  }

  // ガント初版を生成して進捗管理のガントへ
  async function generateAndGo() {
    if (!projectId) return;
    try {
      await api.generateSchedule(projectId, startDate);
      finishToGantt();
    } catch (e) {
      setError(toMessage(e));
    }
  }

  // レビュー自動展開 (US-014)
  async function expandReviews() {
    if (!projectId) return;
    try {
      await api.expandReviews(projectId);
      loadTasks();
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
      loadTasks();
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function save(taskId: string) {
    const d = drafts[taskId] ?? { estimate: '0', util: '1' };
    const estimateDays = Number(d.estimate);
    const utilizationRate = Number(d.util);
    if (Number.isNaN(estimateDays) || estimateDays < 0) {
      setError('見積は 0 以上の数値を入力してください');
      return;
    }
    if (Number.isNaN(utilizationRate) || utilizationRate <= 0 || utilizationRate > 1) {
      setError('稼働率は 0 より大きく 1 以下で入力してください (例: 0.75)');
      return;
    }
    try {
      const updated = await api.updateTask(taskId, {
        estimateDays: round3(estimateDays),
        utilizationRate,
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  if (!loaded) return null;

  if (!draft) {
    return (
      <section>
        <h2>3. 見積・ガント生成</h2>
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            先にプロジェクトを作成し、要件を登録してください。
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
      <h2>3. 見積・ガント生成</h2>
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
          対象プロジェクト: <strong>{draft.name}</strong>。工数は人日(小数自由)。期間 = 工数 ÷
          稼働率(1日 = 8時間)。
        </p>
      </div>

      <div className="card">
        <h3>生成方法を選ぶ</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          ここで WBS(タスク)を作ります。AI は Claude Code(現在のご契約の使用量枠)で実行し、追加課金の
          API は使いません。
        </p>
        <div className="inline-form" style={{ marginTop: 0, flexWrap: 'wrap' }}>
          <button type="button" onClick={aiPlanAndGo}>
            AI で要件からガントまで生成
          </button>
          <button type="button" className="btn-secondary" onClick={aiEstimateOnly}>
            AI で見積だけ生成(後で調整)
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/create/wbs')}>
            手で WBS を組む(ガントから)
          </button>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>タスク見積</h3>
            <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="button" className="btn-secondary" onClick={expandReviews}>
                レビューを自動展開
              </button>
              <button type="button" className="btn-secondary" onClick={addEfficiency}>
                効率化調整を追加
              </button>
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>タスク</th>
                <th>工程</th>
                <th>工数(人日)</th>
                <th>稼働率</th>
                <th>時間</th>
                <th>期間(営業日)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const d = drafts[t.id] ?? { estimate: '0', util: '1' };
                const est = Number(d.estimate) || 0;
                const util = Number(d.util) || 1;
                const isGroup = (t.level ?? 3) < 3;
                return (
                  <tr key={t.id}>
                    <td className="muted">{t.wbsId ?? '—'}</td>
                    <td style={{ paddingLeft: `calc(${(t.level ?? 3) - 1} * var(--space-3))` }}>
                      {t.level === 1 ? <strong>{t.name}</strong> : t.name}
                      {t.kind === 'review' && <span className="badge badge-low"> レビュー</span>}
                      {t.kind === 'efficiency' && <span className="badge badge-medium"> 効率化</span>}
                    </td>
                    <td>{t.phase ?? ''}</td>
                    <td>
                      {isGroup ? (
                        ''
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={minStep}
                          aria-label={`${t.name} の工数`}
                          value={d.estimate}
                          onChange={(e) =>
                            setDrafts((s) => ({ ...s, [t.id]: { ...d, estimate: e.target.value } }))
                          }
                          style={{ width: '6rem' }}
                        />
                      )}
                    </td>
                    <td>
                      {isGroup ? (
                        ''
                      ) : (
                        <input
                          type="number"
                          min={0.05}
                          max={1}
                          step={0.05}
                          aria-label={`${t.name} の稼働率`}
                          value={d.util}
                          onChange={(e) =>
                            setDrafts((s) => ({ ...s, [t.id]: { ...d, util: e.target.value } }))
                          }
                          style={{ width: '5rem' }}
                        />
                      )}
                    </td>
                    <td>{isGroup ? '' : `${effortHours(est)} h`}</td>
                    <td>{isGroup ? '' : `${spanWorkingDays(est, util)} 日`}</td>
                    <td>
                      {!isGroup && (
                        <button type="button" onClick={() => save(t.id)}>
                          保存
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>合計</th>
                <td colSpan={7}>{total} 人日</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="card">
          <h3>ガントを生成</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            見積(人日)と稼働率から、土日・祝日を除いた稼働日でタスクを割り付け、ガントを作成します。
          </p>
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
            <button type="button" onClick={generateAndGo}>
              ガントを生成して進捗管理へ →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
