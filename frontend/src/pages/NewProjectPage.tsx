import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

// 新規プロジェクト (US-020)。名称を入力し、起点(見積から / ガントから)を選んで開始する。
export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function start(mode: 'estimate' | 'gantt') {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const p = await api.createProject({ name: name.trim(), description: description.trim() || undefined });
      // 見積から → 取込画面 / ガントから → WBS 編集画面
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
            要件一覧・見積明細のファイル(テンプレ/自由体裁)や自然文を取り込んで開始 (US-019)
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
          <p className="muted">空のガントに階層タスクを表上で直接 追加・編集して開始 (US-018)</p>
        </button>
      </div>
    </section>
  );
}
