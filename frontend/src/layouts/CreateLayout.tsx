import { Outlet } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';

// 新規作成系シェル (US-021)。ヘッダ + コンテンツ。ワークフローのステッパーは US-023 で追加。
export default function CreateLayout() {
  return (
    <>
      <BrandHeader />
      <main className="shell-content" style={{ margin: '0 auto', maxWidth: 1100 }}>
        <Outlet />
      </main>
    </>
  );
}
