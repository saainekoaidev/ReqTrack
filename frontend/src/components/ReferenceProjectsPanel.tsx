import { useEffect, useState, type FormEvent } from 'react';
import { api, type ReferenceProject } from '../api/client';
import FolderField from './FolderField';

// 参照資料プロジェクト管理 (US-024)。既存改修の資料フォルダを登録・スキャンする。
export default function ReferenceProjectsPanel() {
  const [list, setList] = useState<ReferenceProject[]>([]);
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listReferenceProjects().then(setList).catch((e: unknown) => setError(msg(e)));
  }
  useEffect(reload, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !rootPath.trim()) return;
    try {
      await api.createReferenceProject({ name: name.trim(), rootPath: rootPath.trim(), note: note.trim() || undefined });
      setName('');
      setRootPath('');
      setNote('');
      setError(null);
      reload();
    } catch (e) {
      setError(msg(e));
    }
  }

  async function scan(id: string) {
    setMessage('スキャン中…');
    try {
      const r = await api.scanReferenceProject(id);
      setMessage(`スキャン完了: ${r.scanned} ファイルを読み取りました。`);
      setError(null);
      reload();
    } catch (e) {
      setMessage(null);
      setError(msg(e));
    }
  }

  async function remove(id: string) {
    if (!window.confirm('この参照資料プロジェクトを削除しますか?')) return;
    try {
      await api.deleteReferenceProject(id);
      reload();
    } catch (e) {
      setError(msg(e));
    }
  }

  return (
    <div className="card">
      <h3>参照資料プロジェクト(既存改修用)</h3>
      <p className="muted">
        改修対象の設計書/ソース等の資料フォルダを登録し、スキャンで内容を読み取っておくと、既存案件の見積で参照できます。
      </p>
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

      {list.length === 0 ? (
        <p className="muted">登録された参照資料プロジェクトはありません。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>資料フォルダ</th>
              <th>ファイル数</th>
              <th>最終スキャン</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="muted">{r.rootPath}</td>
                <td>{r._count?.files ?? 0}</td>
                <td className="muted">{r.scannedAt ? r.scannedAt.slice(0, 10) : '未スキャン'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn-link-plain" onClick={() => scan(r.id)}>
                    スキャン
                  </button>{' '}
                  <button type="button" className="btn-link-plain" onClick={() => remove(r.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={add} style={{ display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
        <input type="text" placeholder="名称(例: 既存GSSZ)" aria-label="参照資料名称" value={name} onChange={(e) => setName(e.target.value)} />
        <FolderField value={rootPath} onChange={setRootPath} ariaLabel="資料フォルダのパス" />
        <input type="text" placeholder="メモ(任意)" aria-label="参照資料メモ" value={note} onChange={(e) => setNote(e.target.value)} />
        <div>
          <button type="submit">登録</button>
        </div>
      </form>
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
