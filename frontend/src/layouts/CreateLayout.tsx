import { Outlet } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { CreateStepper } from '../components/CreateStepper';

// 新規作成系シェル (US-021 / US-023)。ヘッダ + ワークフローステッパー + コンテンツ。
export default function CreateLayout() {
  return (
    <>
      <BrandHeader />
      <CreateStepper />
      <main className="shell-content" style={{ margin: '0 auto', maxWidth: 1100 }}>
        <Outlet />
      </main>
    </>
  );
}
