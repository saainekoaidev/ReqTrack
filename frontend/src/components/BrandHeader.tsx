import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useBusy } from '../lib/busy';

// 共通ブランドヘッダ。右側に任意のスロット(プロジェクト選択等)。
// showHome=true で「ホーム」ボタンを表示。処理中はインジケータを掲出 (US-033)。
export function BrandHeader({ right, showHome = true }: { right?: ReactNode; showHome?: boolean }) {
  const busy = useBusy();
  return (
    <header className="app-header">
      <Link to="/" className="brand">
        <Icon name="gantt" size={24} />
        ReqTrack
      </Link>
      {showHome && (
        <Link to="/" className="header-home">
          <Icon name="home" size={16} />
          ホーム
        </Link>
      )}
      {busy > 0 && (
        <span className="busy-indicator" role="status" aria-live="polite">
          <span className="busy-spinner" aria-hidden="true" />
          処理中…
        </span>
      )}
      <span className="spacer" />
      {right}
    </header>
  );
}
