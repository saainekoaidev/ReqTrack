// ピクトグラム的アイコン (US-021)。Windows 標準アイコンではなく自前のインライン SVG。
// 線画(stroke)ベースで淡緑テーマに馴染ませる。

export type IconName =
  | 'home'
  | 'create'
  | 'manage'
  | 'settings'
  | 'gantt'
  | 'report'
  | 'daily'
  | 'delay'
  | 'requirement'
  | 'import'
  | 'task'
  | 'estimate'
  | 'wbs'
  | 'member'
  | 'holiday'
  | 'plus'
  | 'folder';

const PATHS: Record<IconName, string> = {
  home: 'M4 11l8-7 8 7M6 10v9h5v-5h2v5h5v-9',
  // 新規作成: ペン+きらめき
  create: 'M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4zM14 7l3 3',
  // 進捗管理: チェック付きクリップボード
  manage: 'M9 4h6v3H9zM7 5H5v15h14V5h-2M8.5 13l2 2 4-4',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6 6l1.5 1.5M16.5 16.5L18 18M6 18l1.5-1.5M16.5 7.5L18 6',
  // ガント: 横棒バー
  gantt: 'M4 6h9M4 12h13M4 18h6M4 4v16',
  report: 'M6 3h9l3 3v15H6zM14 3v4h4M9 13h6M9 17h6',
  daily: 'M5 5h14v15H5zM5 9h14M8 3v4M16 3v4M9 13h2M13 13h2M9 16h2',
  delay: 'M12 8v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  requirement: 'M7 4h10v16H7zM10 8h4M10 12h4M10 16h2',
  import: 'M12 3v10m0 0l-4-4m4 4l4-4M5 17v3h14v-3',
  task: 'M5 6h14M5 12h14M5 18h14M3.5 6v.01M3.5 12v.01M3.5 18v.01',
  estimate: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h3M8 7h.01',
  wbs: 'M10 4h4v3h-4zM4 14h4v3H4zM16 14h4v3h-4zM12 7v4M6 14v-3h12v3',
  member: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20a7 7 0 0 1 14 0',
  holiday: 'M5 5h14v15H5zM5 9h14M8 3v4M16 3v4M9 14l2 2 4-4',
  plus: 'M12 5v14M5 12h14',
  folder: 'M4 6h6l2 2h8v11H4z',
};

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
