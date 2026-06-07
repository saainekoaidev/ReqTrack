import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type Member, type Project, type Task } from '../api/client';
import { sortTasksByWbs, nextFeatureWbsId, nextChildWbsId } from '../lib/wbs';

// WBS 編集画面 (US-018)。一覧表上で階層タスクを直接 追加・削除・修正する。
export default function WbsEditPage() {
  const [params] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(params.get('projectId') ?? '');
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((ps) => {
        setProjects(ps);
        if (!projectId && ps[0]) setProjectId(ps[0].id);
      })
      .catch((e: unknown) => setError(toMessage(e)));
    api.listMembers().then(setMembers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reload() {
    if (!projectId) return;
    api.listTasks(projectId).then(setTasks).catch((e: unknown) => setError(toMessage(e)));
  }
  useEffect(reload, [projectId]);

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

  return (
    <section>
      <h2>WBS 編集</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="card">
        <div className="inline-form" style={{ marginTop: 0 }}>
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
          <button type="button" onClick={addFeature} disabled={!projectId}>
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
                      step={0.001}
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
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
