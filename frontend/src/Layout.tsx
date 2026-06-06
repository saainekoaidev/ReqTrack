import { NavLink, Outlet } from 'react-router-dom';

// 全画面共通レイアウト。ヘッダ + ナビ + 各ページ(Outlet)。
// ナビ項目は US 実装ごとに増やす。
const navItems: { to: string; label: string }[] = [
  { to: '/', label: 'ホーム' },
  { to: '/requirements', label: '要件' },
];

export default function Layout() {
  return (
    <>
      <header className="app-header">
        <h1>ReqTrack</h1>
        <nav className="app-nav" aria-label="メインナビゲーション">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </>
  );
}
