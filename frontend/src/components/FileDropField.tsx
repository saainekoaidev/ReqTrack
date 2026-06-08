import { useRef, useState, type DragEvent } from 'react';
import { Icon } from './Icon';

// 1行のファイル選択フィールド (US-031)。参照ボタン + ファイルのドラッグ&ドロップ。
export default function FileDropField({
  file,
  onFile,
  accept,
  ariaLabel,
  placeholder = 'ファイルをドラッグ&ドロップ、または参照',
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div
      className={`dropline${over ? ' is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <Icon name="import" size={16} />
      <span className={`dropline-text${file ? '' : ' muted'}`}>{file ? file.name : placeholder}</span>
      {file && (
        <button
          type="button"
          className="dropline-clear"
          aria-label={`${ariaLabel} の選択を取消`}
          title="選択を取消"
          onClick={() => {
            if (input.current) input.current.value = '';
            onFile(null);
          }}
        >
          <Icon name="close" size={14} />
        </button>
      )}
      <label className="dropline-browse">
        参照
        <input
          ref={input}
          type="file"
          accept={accept}
          aria-label={ariaLabel}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          style={{ display: 'none' }}
        />
      </label>
    </div>
  );
}
