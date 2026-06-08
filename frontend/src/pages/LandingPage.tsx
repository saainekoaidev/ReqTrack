import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { Icon, type IconName } from '../components/Icon';
import { api } from '../api/client';

// ランディング(入口) (US-021 / US-032)。目的別に 3 入口へ分ける。
// 進捗管理は、ガント(計画済みタスク)を持つプロジェクトが無い場合は遷移不可。
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
  const [manageEnabled, setManageEnabled] = useState(true);

  useEffect(() => {
    api
      .listProjects()
      .then((ps) => setManageEnabled(ps.some((p) => p.hasSchedule)))
      .catch(() => setManageEnabled(false));
  }, []);

  return (
    <>
      <BrandHeader showHome={false} />
      <div className="landing">
        <h2>ようこそ</h2>
        <p className="muted">
          目的を選んでください。上流(見積・計画)と下流(進捗・遅延)を一気通貫で扱えます。
        </p>
        <div className="entry-grid">
          {entries.map((e) => {
            const disabled = e.to === '/manage' && !manageEnabled;
            if (disabled) {
              return (
                <div key={e.to} className="entry-tile is-disabled" aria-disabled="true">
                  <Icon name={e.icon} size={48} className="tile-icon" />
                  <h3>{e.title}</h3>
                  <p className="muted">{e.desc}</p>
                  <p className="muted">
                    ※ ガントを持つプロジェクトがありません。新規作成で計画を立てると利用できます。
                  </p>
                </div>
              );
            }
            return (
              <Link key={e.to} to={e.to} className="entry-tile">
                <Icon name={e.icon} size={48} className="tile-icon" />
                <h3>{e.title}</h3>
                <p className="muted">{e.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
