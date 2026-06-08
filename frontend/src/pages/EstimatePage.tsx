import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Project, type Task } from '../api/client';
import { effortHours, spanWorkingDays, round3 } from '../lib/estimate';

// 見積画面 (見積入力 + ガント初版生成)。工数(人日, 小数自由値)と稼働率を設定し、期間・時間を確認する。
type Draft = { estimate: string; util: string };

export default function EstimatePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [minStep, setMinStep] = useState(0.1);
  const [startDate, setStartDate] = useState('2026-06-08');
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

  const total = useMemo(() => round3(tasks.reduce((sum, t) => sum + (t.estimateDays || 0), 0)), [tasks]);

  // AI(Claude Code サブスク枠)で見積を生成 (US-036)
  async function aiGenerate() {
    if (!projectId) return;
    setMessage('AI で見積を生成中です(数十秒かかることがあります)…');
    try {
      const r = await api.aiEstimate(projectId);
      setMessage(`AI 見積を生成しました: 機能 ${r.features} 件 / タスク ${r.tasks} 件。`);
      setError(null);
      loadTasks();
    } catch (e) {
      setMessage(null);
      setError(toMessage(e));
    }
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
      localStorage.setItem('reqtrack.projectId', projectId);
      navigate('/manage/gantt');
    } catch (e) {
      setMessage(null);
      setError(toMessage(e));
    }
  }

  // ガント初版を生成して進捗管理のガントへ(新規作成ワークフローの仕上げ)
  async function generateAndGo() {
    if (!projectId) return;
    try {
      await api.generateSchedule(projectId, startDate);
      // 進捗管理シェルの選択プロジェクトを今回の案件に合わせる
      localStorage.setItem('reqtrack.projectId', projectId);
      navigate('/manage/gantt');
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function save(taskId: string) {
    const draft = drafts[taskId] ?? { estimate: '0', util: '1' };
    const estimateDays = Number(draft.estimate);
    const utilizationRate = Number(draft.util);
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

  return (
    <section>
      <h2>見積</h2>
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
        <p className="muted" style={{ marginTop: 'var(--space-2)' }}>
          工数は人日(小数自由)。稼働率で実作業量と期間が変わります(期間 = 工数 ÷ 稼働率、1日 = 8時間)。
        </p>
      </div>

      <div className="card">
        <h3>AI で要件からガントまで生成</h3>
        <p className="muted">
          要件(既存改修は参照資料も)をもとに、Claude Code(現在のご契約の使用量枠)で機能・工程・工数・根拠を生成し、
          そのままスケジュール(開始日 {startDate} から土日祝を除く稼働日)を割り付けてガントを作成します。追加課金の API は使いません。
        </p>
        <div className="inline-form" style={{ marginTop: 0 }}>
          <button type="button" onClick={aiPlanAndGo} disabled={!projectId}>
            AI で要件からガントまで生成
          </button>
          <button type="button" className="btn-secondary" onClick={aiGenerate} disabled={!projectId}>
            見積だけ生成(後で調整)
          </button>
        </div>
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
                return (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>
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
                    </td>
                    <td>
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
                    </td>
                    <td>{effortHours(est)} h</td>
                    <td>{spanWorkingDays(est, util)} 日</td>
                    <td>
                      <button type="button" onClick={() => save(t.id)}>
                        保存
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>合計</th>
                <td colSpan={5}>{total} 人日</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="card">
        <h3>ガント初版を生成</h3>
        <p className="muted">
          見積(人日)と稼働率から、土日・祝日を除いた稼働日でタスクを割り付け、ガントの初版を作成します。
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
          <button type="button" onClick={generateAndGo} disabled={!projectId || tasks.length === 0}>
            ガント初版を生成してガントへ
          </button>
        </div>
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
