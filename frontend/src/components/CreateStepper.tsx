import { Link, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

// 新規作成系ワークフローのステッパー (US-023 / US-038)。3 ステップで現在位置を強調表示する。
interface Step {
  label: string;
  to: string;
  icon: IconName;
  // この step に該当する path(前方一致)
  match: string[];
}

const STEPS: Step[] = [
  { label: 'プロジェクト作成', to: '/create', icon: 'create', match: ['/create'] },
  {
    label: '要件登録',
    to: '/create/requirements',
    icon: 'requirement',
    match: ['/create/requirements', '/create/import'],
  },
  {
    label: '見積・ガント',
    to: '/create/estimate',
    icon: 'estimate',
    match: ['/create/estimate', '/create/wbs', '/create/tasks'],
  },
];

function activeIndex(pathname: string): number {
  // 完全一致を優先しつつ、最長一致の step を現在地とする
  let idx = 0;
  let best = -1;
  STEPS.forEach((s, i) => {
    for (const m of s.match) {
      if (pathname === m || pathname.startsWith(m + '/')) {
        if (m.length > best) {
          best = m.length;
          idx = i;
        }
      }
    }
  });
  return idx;
}

export function CreateStepper() {
  const { pathname } = useLocation();
  const active = activeIndex(pathname);
  return (
    <nav className="stepper" aria-label="作成ワークフロー">
      {STEPS.map((s, i) => {
        const cls = i === active ? 'step is-active' : i < active ? 'step is-done' : 'step';
        return (
          <Link key={s.to} to={s.to} className={cls}>
            <Icon name={s.icon} size={16} />
            <span>
              {i + 1}. {s.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
