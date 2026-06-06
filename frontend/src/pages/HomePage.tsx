import { Link } from 'react-router-dom';

// トップ(ダッシュボード)。各機能への入口を示す。
const links: { to: string; title: string; desc: string }[] = [
  { to: '/requirements', title: '要件', desc: '顧客要件を受け取り登録する (US-001)' },
  { to: '/tasks', title: 'タスク', desc: '要件から作業タスク・工程を洗い出す (US-002)' },
];

export default function HomePage() {
  return (
    <section>
      <h2>ダッシュボード</h2>
      <p className="muted">
        上流(要件→見積→ガント初版)と下流(進捗→遅延対応)を一気通貫で管理します。
      </p>
      <div className="card-grid">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="card card-link">
            <h3>{l.title}</h3>
            <p className="muted">{l.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
