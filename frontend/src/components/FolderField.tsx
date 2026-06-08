import { useState, type DragEvent } from 'react';
import { Icon } from './Icon';
import FsBrowserDialog from './FsBrowserDialog';

// 1行のフォルダ選択フィールド (US-031)。
// 参照(サーバ側フォルダブラウザで実パス選択)+ フォルダのドラッグ&ドロップ(名称を補助入力)。
export default function FolderField({
  value,
  onChange,
  ariaLabel,
  placeholder = 'フォルダのパス(参照 または D&D)',
}: {
  value: string;
  onChange: (path: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const item = e.dataTransfer.items?.[0];
    // ブラウザはフォルダの絶対パスを取得できないため、名称のみ補助的に入れる。
    const entry = item?.webkitGetAsEntry?.();
    if (entry?.isDirectory) {
      onChange(entry.name);
    } else if (e.dataTransfer.files?.[0]) {
      onChange(e.dataTransfer.files[0].name);
    }
  }

  return (
    <>
      <div
        className={`dropline${over ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Icon name="folder" size={16} />
        <input
          type="text"
          className="dropline-input"
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="dropline-browse" onClick={() => setOpen(true)}>
          参照
        </button>
      </div>
      <FsBrowserDialog
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(p) => {
          onChange(p);
          setOpen(false);
        }}
      />
    </>
  );
}
