import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Requirement } from '../api/client';
import { useCreate } from '../context/CreateContext';
import FileDropField from '../components/FileDropField';

// 2. 要件登録 (US-001 / US-019 / US-038)。
// 作成中プロジェクトに対し、要件一覧(見積明細)ファイル1つ または 自然文 で要件を登録する。
// 取込時に WBS は展開しない(WBS は次の「見積・ガント」ステップで生成)。
export default function RequirementsPage() {
  const { draft, loaded } = useCreate();
  const navigate = useNavigate();
  const projectId = draft?.id ?? '';

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [content, setContent] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (!projectId) return;
    api
      .listRequirements(projectId)
      .then(setRequirements)
      .catch((e: unknown) => setError(toMessage(e)));
  }
  useEffect(reload, [projectId]);

  async function addRequirement(e: FormEvent) {
    e.preventDefault();
    if (!content.trim() || !projectId) return;
    try {
      const r = await api.createRequirement({ projectId, content: content.trim() });
      setRequirements((prev) => [...prev, r]);
      setContent('');
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function importText() {
    if (!projectId || !text.trim()) return;
    try {
      const r = await api.importRequirementsText(projectId, text);
      setMessage(`要件 ${r.requirements} 件を取り込みました。`);
      setText('');
      setError(null);
      reload();
    } catch (e) {
      setError(toMessage(e));
    }
  }

  async function importFile() {
    if (!projectId || !file) return;
    try {
      const r = await api.importRequirementsFile(projectId, file);
      setMessage(`ファイルから要件 ${r.requirements} 件を取り込みました。`);
      setFile(null);
      setError(null);
      reload();
    } catch (e) {
      setError(toMessage(e));
    }
  }

  if (!loaded) return null;

  // 作成中プロジェクトが無い場合はステップ1へ誘導
  if (!draft) {
    return (
      <section>
        <h2>2. 要件登録</h2>
        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            先にプロジェクトを作成してください。
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
      <h2>2. 要件登録</h2>
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
          対象プロジェクト: <strong>{draft.name}</strong>（
          {draft.kind === 'existing' ? '既存改修' : '新規開発'}）
        </p>
      </div>

      <div className="card">
        <h3>要件一覧(見積明細)ファイル(xlsx / csv)</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          顧客要件のみでも、弊社の改修案まで書かれていても構いません。1 ファイルを取り込みます。
        </p>
        <FileDropField
          file={file}
          onFile={setFile}
          accept=".xlsx,.csv"
          ariaLabel="要件一覧ファイル"
          placeholder="要件一覧(見積明細)ファイルをドラッグ&ドロップ、または参照"
        />
        <div className="dialog-actions">
          <button type="button" onClick={importFile} disabled={!file}>
            ファイルを取り込む
          </button>
        </div>
      </div>

      <div className="card">
        <h3>自然文から取り込む</h3>
        <textarea
          aria-label="要件テキスト"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'例:\n・ログイン機能が欲しい\n・帳票を出力したい'}
          rows={5}
          style={{ width: '100%' }}
        />
        <div className="dialog-actions">
          <button type="button" onClick={importText} disabled={!text.trim()}>
            テキストを取り込む
          </button>
        </div>
      </div>

      <div className="card">
        <h3>登録済みの要件（{requirements.length} 件）</h3>
        {requirements.length === 0 ? (
          <p className="muted">まだ要件がありません。上の取込、または下の入力で追加してください。</p>
        ) : (
          <ol>
            {requirements.map((r) => (
              <li key={r.id}>{r.content}</li>
            ))}
          </ol>
        )}
        <form onSubmit={addRequirement} className="inline-form">
          <input
            type="text"
            placeholder="要件を1件ずつ追加 (例: ログイン機能が欲しい)"
            aria-label="要件内容"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button type="submit" disabled={!content.trim()}>
            要件を追加
          </button>
        </form>
      </div>

      <div className="inline-form" style={{ marginTop: 0 }}>
        <button type="button" className="btn-secondary" onClick={() => navigate('/create')}>
          ← 戻る
        </button>
        <button
          type="button"
          onClick={() => navigate('/create/estimate')}
          disabled={requirements.length === 0}
          title={requirements.length === 0 ? '要件を1件以上登録してください' : undefined}
        >
          次へ：見積・ガント →
        </button>
      </div>
    </section>
  );
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
