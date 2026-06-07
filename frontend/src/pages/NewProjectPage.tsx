import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ReferenceProject } from '../api/client';

// 新規プロジェクト (US-020 / US-024)。名称・案件区分(新規/既存)を選び、起点を選んで開始する。
export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'new' | 'existing'>('new');
  const [referenceProjectId, setReferenceProjectId] = useState('');
  const [refProjects, setRefProjects] = useState<ReferenceProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listReferenceProjects().then(setRefProjects).catch(() => {});
  }, []);

  async function start(mode: 'estimate' | 'gantt') {
    if (!name.trim() || busy) return;
    if (kind === 'existing' && !referenceProjectId) {
      setError('既存案件では参照資料プロジェクトを選択してください(設定 > 参照資料 で登録)');
      return;
    }
    setBusy(true);
    try {
      const p = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        kind,
        referenceProjectId: kind === 'existing' ? referenceProjectId : undefined,
      });
      navigate(mode === 'estimate' ? `/create/import?projectId=${p.id}` : `/create/wbs?projectId=${p.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>新規プロジェクト</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="card">
        <label style={{ display: 'block' }}>
          プロジェクト名:{' '}
          <input
            type="text"
            aria-label="プロジェクト名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '60%' }}
          />
        </label>
        <label style={{ display: 'block', marginTop: 'var(--space-2)' }}>
          概要(任意):{' '}
          <input
            type="text"
            aria-label="概要"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '60%' }}
          />
        </label>

        <fieldset style={{ marginTop: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
          <legend>案件区分</legend>
          <label style={{ marginRight: 'var(--space-3)' }}>
            <input type="radio" name="kind" checked={kind === 'new'} onChange={() => setKind('new')} /> 新規開発
          </label>
          <label>
            <input type="radio" name="kind" checked={kind === 'existing'} onChange={() => setKind('existing')} /> 既存改修
          </label>
          {kind === 'existing' && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <label>
                参照資料プロジェクト:{' '}
                <select
                  aria-label="参照資料プロジェクト"
                  value={referenceProjectId}
                  onChange={(e) => setReferenceProjectId(e.target.value)}
                >
                  <option value="">(選択)</option>
                  {refProjects.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}（{r._count?.files ?? 0} ファイル）
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted" style={{ marginTop: 'var(--space-1)' }}>
                既存改修は登録済みの参照資料を見積の参照に含めます。未登録なら{' '}
                <Link to="/settings">設定 &gt; 参照資料</Link> で登録・スキャンしてください。
              </p>
            </div>
          )}
        </fieldset>
        <p className="muted" style={{ marginTop: 'var(--space-2)' }}>
          見積の対象範囲はシステム構築部分(基本設計〜結合テスト)です。
        </p>
      </div>

      <div className="card-grid">
        <button
          type="button"
          className="card card-link"
          onClick={() => start('estimate')}
          disabled={!name.trim() || busy}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          <h3>見積から始める</h3>
          <p className="muted">
            要件一覧・見積明細のファイル(テンプレ/自由体裁)や自然文を取り込んで開始します
          </p>
        </button>
        <button
          type="button"
          className="card card-link"
          onClick={() => start('gantt')}
          disabled={!name.trim() || busy}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          <h3>ガントから始める</h3>
          <p className="muted">空のガントに階層タスクを表上で直接 追加・編集して開始します</p>
        </button>
      </div>
    </section>
  );
}
