import { useEffect, useState } from 'react';
import { api, type DelayItem, type DelayedMember, type RecoveryPlan } from '../api/client';
import { useProject } from '../context/ProjectContext';

// 遅延ダッシュボード (US-009 遅れ検出 / US-010 遅れ要員 / US-011 リカバリプラン)。
const severityLabel: Record<RecoveryPlan['actions'][number]['severity'], string> = {
  high: '重度',
  medium: '中度',
  low: '軽微',
};

export default function DelaysPage() {
  const { projectId } = useProject();
  const [delays, setDelays] = useState<DelayItem[]>([]);
  const [delayedMembers, setDelayedMembers] = useState<DelayedMember[]>([]);
  const [recovery, setRecovery] = useState<RecoveryPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    api
      .getDelays(projectId)
      .then(setDelays)
      .catch((e: unknown) => setError(toMessage(e)));
    api
      .getDelayedMembers(projectId)
      .then(setDelayedMembers)
      .catch((e: unknown) => setError(toMessage(e)));
    api
      .getRecoveryPlan(projectId)
      .then(setRecovery)
      .catch((e: unknown) => setError(toMessage(e)));
  }, [projectId]);

  return (
    <section>
      <h2>遅延ダッシュボード</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="card">
        <h3>遅延しているタスク</h3>
        {delays.length === 0 ? (
          <p className="muted">遅延しているタスクはありません。</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>タスク</th>
                <th>担当</th>
                <th>計画(期待)</th>
                <th>実績</th>
                <th>遅れ</th>
                <th>最新コメント(要因)</th>
              </tr>
            </thead>
            <tbody>
              {delays.map((d) => (
                <tr key={d.taskId}>
                  <td>{d.name}</td>
                  <td>{d.assigneeName ?? '—'}</td>
                  <td>{d.expectedProgress}%</td>
                  <td>{d.actualProgress}%</td>
                  <td className="error">▲ {d.behindBy}%</td>
                  <td className="muted">{d.latestComment ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>遅れている要員</h3>
        {delayedMembers.length === 0 ? (
          <p className="muted">遅れている要員はいません。</p>
        ) : (
          <ul className="list-actionable">
            {delayedMembers.map((m) => (
              <li key={m.assigneeId}>
                <span>
                  {m.name}
                  <span className="muted">（遅延タスク {m.taskIds.length} 件）</span>
                </span>
                <span className="error">累計遅れ {m.totalBehind}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>リカバリプラン案</h3>
        {!recovery || recovery.actions.length === 0 ? (
          <p className="muted">遅延がないため、リカバリプランは不要です。</p>
        ) : (
          <>
            <p className="muted">
              遅延 {recovery.delayedCount} 件 / 残作業 合計 約 {recovery.totalRemainingDays} 人日
            </p>
            {recovery.actions.map((a) => (
              <div key={a.taskId} className="recovery-item">
                <h4>
                  <span className={`badge badge-${a.severity}`}>{severityLabel[a.severity]}</span>{' '}
                  {a.taskName}
                  <span className="muted">（遅れ {a.behindBy}% / 残 約 {a.remainingDays} 人日）</span>
                </h4>
                <ul>
                  {a.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
