import { BrandHeader } from '../components/BrandHeader';
import MastersPage from './MastersPage';

// 設定 (US-021 暫定)。US-022 で 基本設定/要員/休日 のタブ画面に刷新する。
export default function SettingsPage() {
  return (
    <>
      <BrandHeader />
      <main className="shell-content" style={{ margin: '0 auto', maxWidth: 1100 }}>
        <h2>設定</h2>
        <MastersPage />
      </main>
    </>
  );
}
