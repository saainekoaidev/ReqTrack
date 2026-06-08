import { useState } from 'react';
import { BrandHeader } from '../components/BrandHeader';
import BasicSettingsPanel from '../components/BasicSettingsPanel';
import MembersPanel from '../components/MembersPanel';
import HolidaysPanel from '../components/HolidaysPanel';
import ReferenceProjectsPanel from '../components/ReferenceProjectsPanel';
import ProjectsPanel from '../components/ProjectsPanel';
import { Icon, type IconName } from '../components/Icon';

// 設定。タブ切替で 基本設定 / 要員 / 休日 / 参照資料 / プロジェクト。
type TabKey = 'basic' | 'members' | 'holidays' | 'references' | 'projects';
const tabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'basic', label: '基本設定', icon: 'settings' },
  { key: 'members', label: '要員', icon: 'member' },
  { key: 'holidays', label: '休日', icon: 'holiday' },
  { key: 'references', label: '参照資料', icon: 'folder' },
  { key: 'projects', label: 'プロジェクト', icon: 'manage' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('basic');
  return (
    <>
      <BrandHeader />
      <main className="shell-content" style={{ margin: '0 auto', maxWidth: 1100 }}>
        <h2>設定</h2>
        <div className="tabs" role="tablist" aria-label="設定タブ">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? 'tab is-active' : 'tab'}
              onClick={() => setTab(t.key)}
            >
              <Icon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'basic' && <BasicSettingsPanel />}
          {tab === 'members' && <MembersPanel />}
          {tab === 'holidays' && <HolidaysPanel />}
          {tab === 'references' && <ReferenceProjectsPanel />}
          {tab === 'projects' && <ProjectsPanel />}
        </div>
      </main>
    </>
  );
}
