import { useEffect, useRef, useState } from 'react';
import { api, type DailyReport, type Member, type Task } from '../api/client';
import { useProject } from '../context/ProjectContext';

// 日報画面 (US-017)。複数タスクの進捗をまとめて登録し、一覧・詳細確認、ガント反映。
type EntryDraft = { checked: boolean; progress: string; comment: string };

export default function DailyReportsPage() {
  const { projectId } = useProject();
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [detail, setDetail] = useState<DailyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 新規ダイアログの入力
  const [memberId, setMemberId] = useState('');
  const [reportDate, setReportDate] = useState('2026-06-07');
  const [note, setNote] = useState('');
  const [drafts, setDrafts] = useState<Record<string, EntryDraft>>({});

  const newDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    api
      .listMembers()
      .then((ms) => {
        setMembers(ms);
        if (ms[0]) setMemberId(ms[0].id);
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }, []);

  function reload() {
    if (!projectId) return;
    api.listDailyReports(projectId).then(setReports).catch((e: unknown) => setError(toMessage(e)));
    api.listTasks(projectId).then(setTasks).catch((e: unknown) => setError(toMessage(e)));
  }
  useEffect(reload, [projectId]);

  // 進捗を入力できる作業タスク(集約行・効率化は除外)
  const selectableTasks = tasks.filter((t) => t.kind !== 'efficiency' && t.level === 3);

  function openNew() {
    setDrafts(
      Object.fromEntries(
        selectableTasks.map((t) => [
          t.id,
          { checked: false, progress: String(t.progress), comment: '' },
        ]),
      ),
    );
    setNote('');
    setMessage(null);
    setError(null);
    newDialog.current?.showModal();
  }

  async function submit() {
    const entries = selectableTasks
      .filter((t) => drafts[t.id]?.checked)
      .map((t) => ({
        taskId: t.id,
        progress: Number(drafts[t.id]!.progress),
        comment: drafts[t.id]!.comment || undefined,
      }));
    if (!memberId) {
      setError('報告者を選択してください');
      return;
    }
    if (entries.length === 0) {
      setError('少なくとも 1 件のタスクを選択してください');
      return;
    }
    if (entries.some((e) => Number.isNaN(e.progress) || e.progress < 0 || e.progress > 100)) {
      setError('進捗率は 0〜100 で入力してください');
      return;
    }
    try {
      await api.createDailyReport({ projectId, memberId, reportDate, note: note || undefined, entries });
      newDialog.current?.close();
      reload();
      setMessage(`日報を登録しました(${entries.length} 件)。ガントの進捗率・全体進捗へ反映されました。`);
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function openDetail(id: string) {
    try {
      const d = await api.getDailyReport(id);
      setDetail(d);
      detailDialog.current?.showModal();
    } catch (e) {
      setError(toMessage(e));
    }
  }

  return (
    <section>
      <h2>日報</h2>
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
        <button type="button" onClick={openNew} disabled={!projectId}>
          新規登録
        </button>
      </div>

      <div className="card">
        <h3>日報一覧</h3>
        {reports.length === 0 ? (
          <p className="muted">日報がありません。「新規登録」から入力してください。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>報告日</th>
                <th>報告者</th>
                <th>件数</th>
                <th>メモ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.reportDate.slice(0, 10)}</td>
                  <td>{r.member?.name ?? ''}</td>
                  <td>{r._count?.entries ?? r.entries?.length ?? 0}</td>
                  <td className="muted">{r.note ?? ''}</td>
                  <td>
                    <button type="button" className="btn-link-plain" onClick={() => openDetail(r.id)}>
                      内容を見る
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 新規登録ダイアログ */}
      <dialog ref={newDialog} className="dialog" aria-label="日報の新規登録">
        <h3>日報の新規登録</h3>
        <div className="inline-form" style={{ marginTop: 0 }}>
          <label>
            報告者:{' '}
            <select aria-label="報告者" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {members.length === 0 && <option value="">(要員なし)</option>}
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            報告日:{' '}
            <input
              type="date"
              aria-label="報告日"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </label>
        </div>
        <label style={{ display: 'block', marginTop: 'var(--space-2)' }}>
          メモ(任意):{' '}
          <input
            type="text"
            aria-label="日報メモ"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: '60%' }}
          />
        </label>

        <h4>進捗を報告するタスクを選択</h4>
        {selectableTasks.length === 0 ? (
          <p className="muted">対象タスクがありません。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>タスク</th>
                <th>進捗率(%)</th>
                <th>コメント</th>
              </tr>
            </thead>
            <tbody>
              {selectableTasks.map((t) => {
                const d = drafts[t.id] ?? { checked: false, progress: '0', comment: '' };
                return (
                  <tr key={t.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${t.name} を選択`}
                        checked={d.checked}
                        onChange={(e) =>
                          setDrafts((s) => ({ ...s, [t.id]: { ...d, checked: e.target.checked } }))
                        }
                      />
                    </td>
                    <td>
                      {t.wbsId ? <span className="muted">{t.wbsId} </span> : null}
                      {t.name}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        aria-label={`${t.name} の進捗率`}
                        value={d.progress}
                        disabled={!d.checked}
                        onChange={(e) =>
                          setDrafts((s) => ({ ...s, [t.id]: { ...d, progress: e.target.value } }))
                        }
                        style={{ width: '5rem' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        aria-label={`${t.name} のコメント`}
                        value={d.comment}
                        disabled={!d.checked}
                        onChange={(e) =>
                          setDrafts((s) => ({ ...s, [t.id]: { ...d, comment: e.target.value } }))
                        }
                        style={{ width: '100%' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn-link-plain" onClick={() => newDialog.current?.close()}>
            キャンセル
          </button>
          <button type="button" onClick={submit}>
            登録
          </button>
        </div>
      </dialog>

      {/* 詳細ダイアログ */}
      <dialog ref={detailDialog} className="dialog" aria-label="日報の詳細">
        {detail && (
          <>
            <h3>
              {detail.reportDate.slice(0, 10)} の日報({detail.member?.name ?? ''})
            </h3>
            {detail.note && <p>{detail.note}</p>}
            <table className="data-table">
              <thead>
                <tr>
                  <th>タスク</th>
                  <th>進捗率</th>
                  <th>コメント</th>
                </tr>
              </thead>
              <tbody>
                {detail.entries?.map((e) => (
                  <tr key={e.id}>
                    <td>{e.task?.name ?? e.taskId}</td>
                    <td>{e.progress}%</td>
                    <td>{e.comment ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dialog-actions">
              <button type="button" onClick={() => detailDialog.current?.close()}>
                閉じる
              </button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
