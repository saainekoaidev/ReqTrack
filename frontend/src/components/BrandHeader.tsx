import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

// 共通ブランドヘッダ。右側に任意のスロット(プロジェクト選択等)。
// showHome=true で「ホーム」ボタンを表示(各機能から最初の画面へ戻る導線)。
export function BrandHeader({ right, showHome = true }: { right?: ReactNode; showHome?: boolean }) {
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
      <span className="spacer" />
      {right}
    </header>
  );
}
