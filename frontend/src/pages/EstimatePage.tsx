import { useEffect, useMemo, useState } from 'react';
import { api, type Project, type Task } from '../api/client';
import { effortHours, spanWorkingDays, round3 } from '../lib/estimate';

// 見積画面 (US-003 / US-012)。工数(人日, 小数自由値)と稼働率を設定し、期間・時間を確認する。
type Draft = { estimate: string; util: string };

export default function EstimatePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [minStep, setMinStep] = useState(0.1);
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

  useEffect(() => {
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
  }, [projectId]);

  const total = useMemo(() => round3(tasks.reduce((sum, t) => sum + (t.estimateDays || 0), 0)), [tasks]);

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
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
