import { useEffect, useState } from 'react';
import { api, type Member, type Task } from '../api/client';
import { sortTasksByWbs, nextFeatureWbsId, nextChildWbsId } from '../lib/wbs';
import { workerCandidates } from '../lib/roles';

// WBS 編集テーブル (US-018 / US-041)。新規作成と進捗管理の両方で共有する。
// 指定プロジェクトの階層タスクを 追加/削除/変更(名称・工程・工数・稼働率・担当)できる。
export default function WbsEditor({
  projectId,
  onChange,
}: {
  projectId: string;
  /** 変更(追加/削除/更新)が起きたら呼ぶ。親がタスク数や日程の再取得に使う。 */
  onChange?: (tasks: Task[]) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listMembers().then(setMembers).catch(() => {});
  }, []);

  function reload() {
    if (!projectId) return;
    api
      .listTasks(projectId)
      .then((ts) => {
        setTasks(ts);
        onChange?.(ts);
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }
  useEffect(reload, [projectId]);

  const ordered = sortTasksByWbs(tasks);
  // 葉(子を持たない)タスクだけが工数/稼働率/担当を持つ。親は配下の集約 (US-049)。
  const childIds = new Set(tasks.map((t) => t.parentId).filter(Boolean) as string[]);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const leafTasks = ordered.filter((t) => !childIds.has(t.id));

  // 前提タスク(predecessor)の設定 (US-050)
  async function setPreds(taskId: string, ids: string[]) {
    try {
      await api.setPredecessors(taskId, ids);
      reload();
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function addFeature() {
    if (!projectId) return;
    try {
      await api.createTask({ projectId, name: '新しい機能', level: 1, wbsId: nextFeatureWbsId(tasks) });
      reload();
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function addChild(parent: Task) {
    if (!projectId) return;
    // 任意の深さに分解可能 (US-049)。WBS 分解法に従い、葉が 1〜3 日程度になるまで掘れる。
    const level = (parent.level ?? 1) + 1;
    try {
      await api.createTask({
        projectId,
        name: level === 2 ? '新しい対象(画面/帳票)' : '新しい作業',
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
      setTasks((prev) => {
        const next = prev.map((x) => (x.id === t.id ? updated : x));
        onChange?.(next);
        return next;
      });
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  return (
    <div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="inline-form" style={{ marginTop: 0, marginBottom: 'var(--space-2)' }}>
        <button type="button" onClick={addFeature}>
          機能を追加
        </button>
        <span className="muted">機能(1.) → 対象(1.1, 画面/帳票) → 作業(1.1.1) の3階層で組み立てます。</span>
      </div>

      {ordered.length === 0 ? (
        <p className="muted">タスクがありません。「機能を追加」から組み立ててください。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>WBS</th>
              <th>タスク名</th>
              <th>工程</th>
              <th>工数(人日)</th>
              <th>稼働率</th>
              <th>担当</th>
              <th>前提タスク</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((t) => {
              const isLeaf = !childIds.has(t.id);
              return (
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
                      style={{ width: '100%', fontWeight: t.level === 1 ? 600 : t.level === 2 ? 500 : 400 }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label={`${t.wbsId ?? t.id} の工程`}
                      defaultValue={t.phase ?? ''}
                      disabled={!isLeaf}
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
                      disabled={!isLeaf}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v !== t.estimateDays) patch(t, { estimateDays: v });
                      }}
                      style={{ width: '5.5rem' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0.001}
                      max={1}
                      step={0.001}
                      aria-label={`${t.wbsId ?? t.id} の稼働率`}
                      defaultValue={t.utilizationRate ?? 1}
                      disabled={!isLeaf}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v) && v > 0 && v <= 1 && v !== t.utilizationRate)
                          patch(t, { utilizationRate: v });
                      }}
                      style={{ width: '5rem' }}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`${t.wbsId ?? t.id} の担当`}
                      value={t.assigneeId ?? ''}
                      disabled={!isLeaf}
                      onChange={(e) => patch(t, { assigneeId: e.target.value || null })}
                    >
                      <option value="">(未割当)</option>
                      {workerCandidates(members).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {isLeaf ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', alignItems: 'center' }}>
                        {(t.predecessorIds ?? []).map((pid) => (
                          <span key={pid} className="pred-chip">
                            {byId.get(pid)?.wbsId ?? '?'}
                            <button
                              type="button"
                              aria-label={`前提 ${byId.get(pid)?.wbsId ?? pid} を外す`}
                              onClick={() =>
                                setPreds(t.id, (t.predecessorIds ?? []).filter((x) => x !== pid))
                              }
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <select
                          aria-label={`${t.wbsId ?? t.id} の前提タスクを追加`}
                          value=""
                          onChange={(e) => {
                            if (e.target.value)
                              setPreds(t.id, [...(t.predecessorIds ?? []), e.target.value]);
                          }}
                        >
                          <option value="">+ 前提</option>
                          {leafTasks
                            .filter(
                              (c) => c.id !== t.id && !(t.predecessorIds ?? []).includes(c.id),
                            )
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.wbsId} {c.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn-link-plain" onClick={() => addChild(t)}>
                      子追加
                    </button>{' '}
                    <button type="button" className="btn-link-plain" onClick={() => remove(t)}>
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
