import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

// サーバ側フォルダブラウザのモーダル (US-031)。実パスを選んで返す。
export default function FsBrowserDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [cur, setCur] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ name: string; path: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      ref.current?.showModal();
      load('');
    } else {
      ref.current?.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function load(path: string) {
    api
      .fsList(path || undefined)
      .then((r) => {
        setCur(r.path);
        setParent(r.parent);
        setEntries(r.entries);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }

  return (
    <dialog ref={ref} className="dialog" aria-label="フォルダの参照" onClose={onClose}>
      <h3>フォルダを選択</h3>
      <p className="muted">現在: {cur || '(ドライブ)'}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="fs-list">
        {parent !== null && (
          <button type="button" className="fs-item" onClick={() => load(parent)}>
            📁 .. (上へ)
          </button>
        )}
        {entries.map((e) => (
          <button key={e.path} type="button" className="fs-item" onClick={() => load(e.path)}>
            📁 {e.name}
          </button>
        ))}
        {entries.length === 0 && parent === null && (
          <p className="muted">ドライブが見つかりません。</p>
        )}
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn-link-plain" onClick={onClose}>
          キャンセル
        </button>
        <button type="button" disabled={!cur} onClick={() => cur && onSelect(cur)}>
          このフォルダを選択
        </button>
      </div>
    </dialog>
  );
}
