import { Link } from 'react-router-dom';

// トップ(ダッシュボード)。各機能への入口を示す。
const links: { to: string; title: string; desc: string }[] = [
  { to: '/new', title: '＋ 新規プロジェクト', desc: '見積から / ガントから 起点を選んで開始 (US-020)' },
  { to: '/requirements', title: '要件', desc: '顧客要件を受け取り登録する (US-001)' },
  { to: '/import', title: '取込', desc: 'ファイル/自然文から要件・見積を取り込む (US-019)' },
  { to: '/tasks', title: 'タスク', desc: '要件から作業タスク・工程を洗い出す (US-002)' },
  { to: '/wbs', title: 'WBS編集', desc: 'ガントの階層タスクを表上で直接編集 (US-018)' },
  { to: '/estimate', title: '見積', desc: 'タスクに工数(人日)を見積もる (US-003)' },
  { to: '/gantt', title: 'ガント', desc: '見積からガント初版を生成し可視化する (US-004)' },
  { to: '/masters', title: 'マスタ', desc: '要員・祝日を登録する (US-005 / US-006)' },
  { to: '/reports', title: '進捗報告', desc: '要員がタスクの進捗を報告する (US-007)' },
  { to: '/daily', title: '日報', desc: '複数タスクの進捗を日報でまとめて登録 (US-017)' },
  { to: '/delays', title: '遅延', desc: '遅れの検出・遅れ要員・リカバリ案 (US-009〜011)' },
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
