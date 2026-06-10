import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ProjectKind, type ReferenceProject } from '../api/client';
import { useCreate } from '../context/CreateContext';

// 1. プロジェクト作成 (US-020 / US-024 / US-038 / US-060)。
// 作成前: 名称・区分(マスタ)を入力して作成。作成後: 入力を非活性表示にし「やり直し」「次へ」のみ。
export default function NewProjectPage() {
  const { draft, loaded, setDraft, clearDraft } = useCreate();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kinds, setKinds] = useState<ProjectKind[]>([]);
  const [kindId, setKindId] = useState('');
  const [referenceProjectId, setReferenceProjectId] = useState('');
  const [refProjects, setRefProjects] = useState<ReferenceProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listReferenceProjects().then(setRefProjects).catch(() => {});
    api
      .listProjectKinds()
      .then((ks) => {
        setKinds(ks);
        if (ks[0]) setKindId(ks[0].id);
      })
      .catch(() => {});
  }, []);

  const selectedKind = kinds.find((k) => k.id === kindId);

  async function create() {
    if (!name.trim() || busy) return;
    if (selectedKind?.requiresReference && !referenceProjectId) {
      setError(`「${selectedKind.name}」では参照資料プロジェクトを選択してください(設定 > 参照資料 で登録)`);
      return;
    }
    setBusy(true);
    try {
      const p = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        kind: selectedKind?.name,
        referenceProjectId: selectedKind?.requiresReference ? referenceProjectId : undefined,
      });
      setDraft(p.id);
      navigate('/create/requirements');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  // 作成中プロジェクトを破棄して最初からやり直す
  async function reset() {
    if (!draft) return;
    if (!window.confirm(`作成中のプロジェクト「${draft.name}」を破棄して最初からやり直しますか?`))
      return;
    setBusy(true);
    try {
      await api.deleteProject(draft.id);
      clearDraft();
      setName('');
      setDescription('');
      setKindId(kinds[0]?.id ?? '');
      setReferenceProjectId('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  // ---- 作成後: ロック表示 ----
  if (draft) {
    const refName = refProjects.find((r) => r.id === draft.referenceProjectId)?.name;
    return (
      <section>
        <h2>1. プロジェクト作成</h2>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            このプロジェクトを作成中です。内容を変えるには「やり直し」で破棄して作り直してください。
          </p>
          <dl className="locked-summary">
            <dt>プロジェクト名</dt>
            <dd>{draft.name}</dd>
            <dt>概要</dt>
            <dd>{draft.description || '（なし）'}</dd>
            <dt>案件区分</dt>
            <dd>{draft.kind || '（未設定）'}</dd>
            {draft.referenceProjectId && (
              <>
                <dt>参照資料</dt>
                <dd>{refName ?? '（不明）'}</dd>
              </>
            )}
          </dl>
        </div>
        <div className="inline-form" style={{ marginTop: 0 }}>
          <button type="button" className="btn-danger" onClick={reset} disabled={busy}>
            やり直し（破棄）
          </button>
          <button type="button" onClick={() => navigate('/create/requirements')}>
            次へ：要件登録 →
          </button>
        </div>
      </section>
    );
  }

  // ---- 作成前: 入力フォーム ----
  return (
    <section>
      <h2>1. プロジェクト作成</h2>
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

        <fieldset
          style={{
            marginTop: 'var(--space-3)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <legend>案件区分</legend>
          <label>
            区分:{' '}
            <select aria-label="案件区分" value={kindId} onChange={(e) => setKindId(e.target.value)}>
              {kinds.length === 0 && <option value="">(読み込み中)</option>}
              {kinds.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          {selectedKind?.note && (
            <p className="muted" style={{ marginTop: 'var(--space-1)' }}>
              {selectedKind.note}
            </p>
          )}
          <p className="muted" style={{ marginTop: 'var(--space-1)' }}>
            案件区分は <Link to="/settings">設定 &gt; 案件区分</Link> で増減・編集できます。
          </p>
          {selectedKind?.requiresReference && (
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
                この区分は登録済みの参照資料を見積の参照に含めます。未登録なら{' '}
                <Link to="/settings">設定 &gt; 参照資料</Link> で登録・スキャンしてください。
              </p>
            </div>
          )}
        </fieldset>
        <p className="muted" style={{ marginTop: 'var(--space-2)' }}>
          見積の対象範囲はシステム構築部分(基本設計〜結合テスト)です。
        </p>
      </div>

      <div className="inline-form" style={{ marginTop: 0 }}>
        <button type="button" onClick={create} disabled={!name.trim() || busy}>
          プロジェクトを作成して次へ →
        </button>
      </div>
    </section>
  );
}
