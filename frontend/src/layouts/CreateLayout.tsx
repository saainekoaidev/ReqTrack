import { Outlet } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { CreateStepper } from '../components/CreateStepper';
import { CreateProvider } from '../context/CreateContext';

// 新規作成系シェル (US-021 / US-023 / US-038)。ヘッダ + 3 ステップのステッパー + コンテンツ。
// 作成中プロジェクトは CreateProvider で全ステップ共有する。
export default function CreateLayout() {
  return (
    <CreateProvider>
      <BrandHeader />
      <CreateStepper />
      <main className="shell-content" style={{ margin: '0 auto', maxWidth: 1100 }}>
        <Outlet />
      </main>
    </CreateProvider>
  );
}
