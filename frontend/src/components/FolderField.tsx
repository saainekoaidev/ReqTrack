import { useState } from 'react';
import { Icon } from './Icon';
import FsBrowserDialog from './FsBrowserDialog';

// 1行のフォルダ選択フィールド (US-031 / US-033)。
// 「参照」(サーバ側フォルダブラウザで実パス選択)+ 手入力。フォルダの D&D はブラウザ制約で
// 絶対パスが取得できず誤登録の原因になるため採用しない。
export default function FolderField({
  value,
  onChange,
  ariaLabel,
  placeholder = 'フォルダのパス(「参照」から選択 または 直接入力)',
}: {
  value: string;
  onChange: (path: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="dropline">
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
