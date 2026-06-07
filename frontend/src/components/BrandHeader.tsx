import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

// 共通ブランドヘッダ (US-021)。右側に任意のスロット(プロジェクト選択等)。
export function BrandHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="app-header">
      <Link to="/" className="brand">
        <Icon name="gantt" size={24} />
        ReqTrack
      </Link>
      <span className="spacer" />
      {right}
    </header>
  );
}
