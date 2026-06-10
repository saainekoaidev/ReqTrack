import { useState } from 'react';
import type { Member, Task } from '../api/client';
import { workerCandidates } from '../lib/roles';
import {
  buildGantt,
  weekdayJa,
  fmtDateYmd,
  phaseColor,
  phaseLegend,
  type GanttRow,
} from '../lib/gantt';

// 葉行の編集で更新できる項目 (US-046)
export type GanttPatch = {
  name?: string;
  estimateDays?: number;
  utilizationRate?: number;
  assigneeId?: string | null;
};

// ガントチャート表示 (US-004 / US-015 / US-040)。
// 左に WBS 3階層(機能/対象/作業)の表(折り畳み可)、右に稼働時間軸の連続バー(小数日対応・コマ無し)。
const LEFT_COLS = '64px 230px 80px 78px 52px 96px 96px 84px';
const LEFT_WIDTH = 64 + 230 + 80 + 78 + 52 + 96 + 96 + 84; // = 780
const MIN_DAY_PX = 34;

export default function GanttChart({
  tasks,
  holidays = new Set<string>(),
  hoursPerDay = 8,
  members,
  onPatch,
}: {
  tasks: Task[];
  holidays?: ReadonlySet<string>;
  hoursPerDay?: number;
  /** インライン編集 (US-046)。指定すると葉行の 名称/工数/稼働率/担当 を編集できる。 */
  members?: Member[];
  onPatch?: (taskId: string, data: GanttPatch) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { rows, axis, totalWT, months } = buildGantt(tasks, holidays, hoursPerDay);

  if (rows.length === 0 || axis.length === 0) {
    return (
      <p className="muted">計画日が設定されたタスクがありません。「スケジュールを再生成」してください。</p>
    );
  }

  const visible = rows.filter((r) => !r.ancestorIds.some((id) => collapsed.has(id)));
  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 月セグメントの軸位置(年込みラベル)
  const monthSegs: { label: string; start: number; span: number }[] = [];
  let acc = 0;
  for (const m of months) {
    monthSegs.push({ label: m.label, start: acc, span: m.span });
    acc += m.span;
  }
  const pct = (wt: number) => `${(wt / totalWT) * 100}%`;
  const ganttMinWidth = LEFT_WIDTH + axis.length * MIN_DAY_PX;

  return (
    <div className="gantt2-card">
      <div
        className="gantt2"
        style={{ minWidth: ganttMinWidth }}
        role="table"
        aria-label="ガントチャート"
      >
        {/* 月ヘッダ */}
        <div className="g2-row g2-head">
          <div className="g2-left" style={{ gridTemplateColumns: LEFT_COLS }}>
            <div className="g2-cell g2-span" style={{ gridColumn: '1 / -1' }}>
              年/月
            </div>
          </div>
          <div className="g2-chart">
            {monthSegs.map((m, i) => (
              <div
                key={i}
                className="g2-month"
                style={{ left: pct(m.start), width: pct(m.span) }}
                title={m.label}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* 列見出し + 日付軸 */}
        <div className="g2-row g2-head">
          <div className="g2-left" style={{ gridTemplateColumns: LEFT_COLS }}>
            <div className="g2-cell">No</div>
            <div className="g2-cell">タスク</div>
            <div className="g2-cell">工程</div>
            <div className="g2-cell">工数(人日)</div>
            <div className="g2-cell">稼働率</div>
            <div className="g2-cell">開始</div>
            <div className="g2-cell">終了</div>
            <div className="g2-cell">担当</div>
          </div>
          <div className="g2-chart">
            {axis.map((d, i) => (
              <div key={i} className="g2-day" style={{ left: pct(d.wtStart), width: pct(1) }}>
                <span>{d.date.getUTCDate()}</span>
                <span className="g2-wd">{weekdayJa(d.date)}</span>
              </div>
            ))}
          </div>
        </div>

        {visible.map((row) => (
          <GanttRowView
            key={row.task.id}
            row={row}
            collapsed={collapsed.has(row.task.id)}
            onToggle={() => toggle(row.task.id)}
            totalWT={totalWT}
            members={members}
            onPatch={onPatch}
          />
        ))}
      </div>

      <div className="gantt-legend">
        {phaseLegend().map((l) => (
          <span key={l.label} className="gantt-legend-item">
            <span className="gantt-legend-swatch" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function GanttRowView({
  row,
  collapsed,
  onToggle,
  totalWT,
  members,
  onPatch,
}: {
  row: GanttRow;
  collapsed: boolean;
  onToggle: () => void;
  totalWT: number;
  members?: Member[];
  onPatch?: (taskId: string, data: GanttPatch) => void;
}) {
  const t = row.task;
  const isLeaf = !row.hasChildren;
  const editable = !!onPatch && isLeaf;
  const color = phaseColor(t.phase);
  const pctLeft = row.startWT != null ? (row.startWT / totalWT) * 100 : 0;
  const pctWidth =
    row.startWT != null && row.endWT != null
      ? Math.max(0.4, ((row.endWT - row.startWT) / totalWT) * 100)
      : 0;

  return (
    <div className="g2-row">
      <div className="g2-left" style={{ gridTemplateColumns: LEFT_COLS }}>
        <div className="g2-cell muted">{t.wbsId ?? ''}</div>
        <div
          className="g2-cell g2-name"
          style={{ paddingLeft: `calc(${row.depth} * var(--space-3))` }}
          title={t.name}
        >
          {row.hasChildren ? (
            <button type="button" className="g2-toggle" onClick={onToggle} aria-label={collapsed ? '展開' : '折り畳み'}>
              {collapsed ? '▶' : '▼'}
            </button>
          ) : (
            <span className="g2-toggle-spacer" />
          )}
          {editable ? (
            <input
              type="text"
              aria-label={`${t.wbsId ?? t.id} の名称`}
              defaultValue={t.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== t.name)
                  onPatch!(t.id, { name: e.target.value.trim() });
              }}
              style={{ width: '100%' }}
            />
          ) : (
            <span style={{ fontWeight: row.depth === 0 ? 700 : row.depth === 1 ? 600 : 400 }}>
              {t.name}
            </span>
          )}
          {t.kind === 'review' && <span className="badge badge-low"> レビュー</span>}
          {t.kind === 'efficiency' && <span className="badge badge-medium"> 効率化</span>}
        </div>
        <div className="g2-cell">{t.phase ?? ''}</div>
        <div className="g2-cell g2-num">
          {editable ? (
            <input
              type="number"
              min={0}
              step={0.1}
              aria-label={`${t.wbsId ?? t.id} の工数`}
              defaultValue={t.estimateDays}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v) && v !== t.estimateDays) onPatch!(t.id, { estimateDays: v });
              }}
              style={{ width: '100%' }}
            />
          ) : (
            row.totalDays || ''
          )}
        </div>
        <div className="g2-cell g2-num">
          {editable ? (
            <input
              type="number"
              min={0.05}
              max={1}
              step={0.05}
              aria-label={`${t.wbsId ?? t.id} の稼働率`}
              defaultValue={t.utilizationRate ?? 1}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v) && v > 0 && v <= 1 && v !== t.utilizationRate)
                  onPatch!(t.id, { utilizationRate: v });
              }}
              style={{ width: '100%' }}
            />
          ) : isLeaf ? (
            `${Math.round((t.utilizationRate ?? 1) * 100)}%`
          ) : (
            ''
          )}
        </div>
        <div className="g2-cell">{fmtDateYmd(row.startDate)}</div>
        <div className="g2-cell">{fmtDateYmd(row.endDate)}</div>
        <div className="g2-cell">
          {editable ? (
            <select
              aria-label={`${t.wbsId ?? t.id} の担当`}
              value={t.assigneeId ?? ''}
              onChange={(e) => onPatch!(t.id, { assigneeId: e.target.value || null })}
              style={{ width: '100%' }}
            >
              <option value="">(未割当)</option>
              {workerCandidates(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            t.assignee?.name ?? ''
          )}
        </div>
      </div>
      <div className="g2-chart">
        {row.startWT != null && (
          <div
            className={`g2-bar${isLeaf ? '' : ' is-summary'}`}
            title={`${t.name}${isLeaf ? `: 進捗 ${t.progress}%` : ''}`}
            style={{
              left: `${pctLeft}%`,
              width: `${pctWidth}%`,
              background: isLeaf ? color : undefined,
              borderColor: isLeaf ? color : undefined,
            }}
          >
            {isLeaf && (
              <>
                <span
                  className="g2-bar-progress"
                  data-testid={`progress-${t.id}`}
                  style={{ width: `${t.progress}%` }}
                />
                <span className="g2-bar-label">{t.progress}%</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
