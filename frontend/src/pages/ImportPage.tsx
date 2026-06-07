import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type Project } from '../api/client';

// 取込画面 (US-019)。要件一覧/見積明細(テンプレ/自由体裁)・自然文 → 見積/ガントへ展開。
export default function ImportPage() {
  const [params] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(params.get('projectId') ?? '');
  const [text, setText] = useState('');
  const [expand, setExpand] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reqFile = useRef<HTMLInputElement>(null);
  const estFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((ps) => {
        setProjects(ps);
        if (!projectId && ps[0]) setProjectId(ps[0].id);
      })
      .catch((e: unknown) => setError(toMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function done(r: { requirements?: number; tasks?: number }) {
    const parts: string[] = [];
    if (r.requirements != null) parts.push(`要件 ${r.requirements} 件`);
    if (r.tasks != null) parts.push(`タスク ${r.tasks} 件`);
    setMessage(`取り込みました(${parts.join(' / ')})。WBS編集・ガントで確認できます。`);
    setError(null);
  }

  async function importText() {
    if (!projectId || !text.trim()) return;
    try {
      done(await api.importRequirementsText(projectId, text, expand));
      setText('');
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function importReqFile() {
    const f = reqFile.current?.files?.[0];
    if (!projectId || !f) return;
    try {
      done(await api.importRequirementsFile(projectId, f, expand));
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function importEstFile() {
    const f = estFile.current?.files?.[0];
    if (!projectId || !f) return;
    try {
      done(await api.importEstimateFile(projectId, f));
    } catch (e) {
      setError(toMessage(e));
    }
  }

  return (
    <section>
      <h2>取込</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="muted" role="status">
          {message} <Link to="/create/wbs">WBS編集へ</Link> / <Link to="/manage/gantt">ガントへ</Link>
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
        <label style={{ marginLeft: 'var(--space-3)' }}>
          <input type="checkbox" checked={expand} onChange={(e) => setExpand(e.target.checked)} />{' '}
          標準工程へ展開する
        </label>
        <p className="muted" style={{ marginTop: 'var(--space-2)' }}>
          テンプレ(要件列/見積列のヘッダ)があれば高精度。自由体裁・自然文でも取り込めます(精度は割り切り)。
        </p>
      </div>

      <div className="card">
        <h3>自然文から要件取込</h3>
        <textarea
          aria-label="要件テキスト"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'例:\n・ログイン機能が欲しい\n・帳票を出力したい'}
          rows={6}
          style={{ width: '100%' }}
        />
        <div className="dialog-actions">
          <button type="button" onClick={importText} disabled={!projectId || !text.trim()}>
            テキストを取込
          </button>
        </div>
      </div>

      <div className="card">
        <h3>要件一覧ファイル(xlsx / csv)</h3>
        <input ref={reqFile} type="file" accept=".xlsx,.csv" aria-label="要件一覧ファイル" />
        <div className="dialog-actions">
          <button type="button" onClick={importReqFile} disabled={!projectId}>
            要件ファイルを取込
          </button>
        </div>
      </div>

      <div className="card">
        <h3>見積明細ファイル(xlsx / csv)</h3>
        <input ref={estFile} type="file" accept=".xlsx,.csv" aria-label="見積明細ファイル" />
        <p className="muted">WBS / タスク / 工程 / 工数 / 稼働率 / 担当 の列を見出しから判定します。</p>
        <div className="dialog-actions">
          <button type="button" onClick={importEstFile} disabled={!projectId}>
            見積明細を取込
          </button>
        </div>
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
