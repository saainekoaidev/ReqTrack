import { NavLink, Outlet } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { Icon, type IconName } from '../components/Icon';
import { ProjectProvider, useProject } from '../context/ProjectContext';

// 進捗管理系シェル (US-021)。ヘッダ右上にプロジェクト選択、左ペインに遷移メニュー。
const menu: { to: string; icon: IconName; label: string }[] = [
  { to: '/manage/gantt', icon: 'gantt', label: 'ガントチャート' },
  { to: '/manage/reports', icon: 'report', label: '進捗報告' },
  { to: '/manage/daily', icon: 'daily', label: '日報' },
  { to: '/manage/delays', icon: 'delay', label: '遅延対応' },
];

function ProjectPicker() {
  const { projects, projectId, setProjectId } = useProject();
  return (
    <span className="header-project">
      <Icon name="folder" size={16} />
      参照プロジェクト:
      <select
        aria-label="参照プロジェクト"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
      >
        {projects.length === 0 && <option value="">(プロジェクトなし)</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </span>
  );
}

export default function ManageLayout() {
  return (
    <ProjectProvider>
      <BrandHeader right={<ProjectPicker />} />
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
        <main className="shell-content">
          <Outlet />
        </main>
      </div>
    </ProjectProvider>
  );
}
