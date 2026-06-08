import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { Icon, type IconName } from '../components/Icon';
import { ProjectProvider, useProject } from '../context/ProjectContext';

// 進捗管理系シェル (US-021 / US-032)。ヘッダ右上にプロジェクト選択、左ペインに遷移メニュー。
// ガント(計画済みタスク)を持つプロジェクトが無い場合は遷移不可(案内表示)。
const menu: { to: string; icon: IconName; label: string }[] = [
  { to: '/manage/gantt', icon: 'gantt', label: 'ガントチャート' },
  { to: '/manage/reports', icon: 'report', label: '進捗報告' },
  { to: '/manage/daily', icon: 'daily', label: '日報' },
  { to: '/manage/delays', icon: 'delay', label: '遅延対応' },
];

function ProjectPicker({ eligible }: { eligible: { id: string; name: string }[] }) {
  const { projectId, setProjectId } = useProject();
  return (
    <span className="header-project">
      <Icon name="folder" size={16} />
      参照プロジェクト:
      <select
        aria-label="参照プロジェクト"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
      >
        {eligible.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </span>
  );
}

function ManageInner() {
  const { projects, projectId, setProjectId, loaded } = useProject();
  const eligible = projects.filter((p) => p.hasSchedule);

  // 選択中プロジェクトがガント保有でなければ、保有プロジェクトへ寄せる
  useEffect(() => {
    if (eligible.length > 0 && !eligible.some((p) => p.id === projectId)) {
      setProjectId(eligible[0]!.id);
    }
  }, [eligible, projectId, setProjectId]);

  if (loaded && eligible.length === 0) {
    return (
      <>
        <BrandHeader />
        <main className="shell-content" style={{ margin: '0 auto', maxWidth: 760 }}>
          <div className="card">
            <h2>表示できるガントがありません</h2>
            <p className="muted">
              進捗管理は、ガント(計画済みタスク)を持つプロジェクトが必要です。
              新規作成からプロジェクトを起こし、「見積」でガント初版を生成してください。
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
              <Link to="/create" className="btn-link">
                新規作成へ
              </Link>
              <Link to="/" className="btn-link">
                ホームへ
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <BrandHeader right={<ProjectPicker eligible={eligible} />} />
      <div className="shell">
        <nav className="side-nav" aria-label="進捗管理メニュー">
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) => (isActive ? 'side-link is-active' : 'side-link')}
            >
              <Icon name={m.icon} size={18} />
              {m.label}
            </NavLink>
          ))}
        </nav>
        <main className="shell-content shell-content--wide">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export default function ManageLayout() {
  return (
    <ProjectProvider>
      <ManageInner />
    </ProjectProvider>
  );
}
