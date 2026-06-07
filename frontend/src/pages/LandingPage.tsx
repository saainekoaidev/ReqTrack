import { Link } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { Icon, type IconName } from '../components/Icon';

// ランディング(入口) (US-021)。目的別に 3 入口へ分ける。
const entries: { to: string; icon: IconName; title: string; desc: string }[] = [
  {
    to: '/create',
    icon: 'create',
    title: '新規作成',
    desc: '要件・見積からプロジェクトを起こし、WBS とガントを作成します。',
  },
  {
    to: '/manage',
    icon: 'manage',
    title: '進捗管理',
    desc: 'ガント確認・進捗報告・日報・遅延対応など、実行中の管理を行います。',
  },
  {
    to: '/settings',
    icon: 'settings',
    title: '設定',
    desc: '基本設定・要員登録・休日登録をまとめて行います。',
  },
];

export default function LandingPage() {
  return (
    <>
      <BrandHeader showHome={false} />
      <div className="landing">
        <h2>ようこそ</h2>
        <p className="muted">
          目的を選んでください。上流(見積・計画)と下流(進捗・遅延)を一気通貫で扱えます。
        </p>
        <div className="entry-grid">
          {entries.map((e) => (
            <Link key={e.to} to={e.to} className="entry-tile">
              <Icon name={e.icon} size={48} className="tile-icon" />
              <h3>{e.title}</h3>
              <p className="muted">{e.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
