import type { Task } from '../api/client';
import {
  buildGantt,
  dayOfMonth,
  weekdayJa,
  isWeekend,
  monthSpans,
  phaseColor,
  phaseLegend,
  type GanttRow,
} from '../lib/gantt';

// ガントチャート表示 (US-004 / US-008 / US-015)。ce2 準拠の列項目 + 営業日軸。
// 固定列: No / フェーズ / 対象 / 作業タスク / 工数 / 稼働率 / 開始 / 終了 / 担当者
const FIXED_COLS = 9;

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export default function GanttChart({
  tasks,
  holidays = new Set<string>(),
}: {
  tasks: Task[];
  holidays?: ReadonlySet<string>;
}) {
  const { days, rows } = buildGantt(tasks);

  if (rows.length === 0) {
    return (
      <p className="muted">計画日が設定されたタスクがありません。「ガント初版を生成」してください。</p>
    );
  }

  const gridTemplate = `36px 90px 110px 180px 56px 48px 52px 52px 90px repeat(${days.length}, 24px)`;
  const months = monthSpans(days);
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const isOff = (d: Date) => isWeekend(d) || holidays.has(dayKey(d));

  return (
    <div className="gantt" role="table" aria-label="ガントチャート">
      {/* 月ヘッダ行 */}
      <div className="gantt-row gantt-head" role="row" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="gantt-cell gantt-fixed" style={{ gridColumn: `1 / span ${FIXED_COLS}` }}>
          (月)
        </div>
        {months.map((m, i) => (
          <div
            key={i}
            className="gantt-cell gantt-month"
            style={{ gridColumn: `span ${m.span}` }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* 列見出し + 日付/曜日行 */}
      <div className="gantt-row gantt-head" role="row" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="gantt-cell gantt-fixed">No</div>
        <div className="gantt-cell gantt-fixed">フェーズ</div>
        <div className="gantt-cell gantt-fixed">対象</div>
        <div className="gantt-cell gantt-fixed">作業タスク</div>
        <div className="gantt-cell gantt-fixed">工数</div>
        <div className="gantt-cell gantt-fixed">稼働率</div>
        <div className="gantt-cell gantt-fixed">開始</div>
        <div className="gantt-cell gantt-fixed">終了</div>
        <div className="gantt-cell gantt-fixed">担当者</div>
        {days.map((d, i) => (
          <div
            key={i}
            className={`gantt-cell gantt-axis${isOff(d) ? ' is-weekend' : ''}`}
            role="columnheader"
          >
            <span>{dayOfMonth(d)}</span>
            <span className="gantt-wd">{weekdayJa(d)}</span>
          </div>
        ))}
      </div>

      {rows.map((row, ri) => (
        <GanttRowView
          key={row.task.id}
          row={row}
          rowNo={ri + 1}
          days={days}
          isOff={isOff}
          gridTemplate={gridTemplate}
        />
      ))}

      {/* 凡例 */}
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
  rowNo,
  days,
  isOff,
  gridTemplate,
}: {
  row: GanttRow;
  rowNo: number;
  days: Date[];
  isOff: (d: Date) => boolean;
  gridTemplate: string;
}) {
  const t = row.task;
  const color = phaseColor(t.phase);
  return (
    <div className="gantt-row" role="row" style={{ gridTemplateColumns: gridTemplate }}>
      <div className="gantt-cell gantt-fixed muted">{t.wbsId ?? rowNo}</div>
      <div className="gantt-cell gantt-fixed">{t.phase ?? ''}</div>
      <div className="gantt-cell gantt-fixed" title={t.requirement?.content ?? ''}>
        {t.requirement?.content ?? ''}
      </div>
      <div className="gantt-cell gantt-fixed gantt-name" title={t.name}>
        {t.name}
      </div>
      <div className="gantt-cell gantt-fixed">{t.estimateDays}</div>
      <div className="gantt-cell gantt-fixed">{Math.round((t.utilizationRate ?? 1) * 100)}%</div>
      <div className="gantt-cell gantt-fixed">{fmtDate(t.plannedStart)}</div>
      <div className="gantt-cell gantt-fixed">{fmtDate(t.plannedEnd)}</div>
      <div className="gantt-cell gantt-fixed">{t.assignee?.name ?? ''}</div>
      {days.map((d, i) => (
        <div
          key={i}
          className={`gantt-cell gantt-track${isOff(d) ? ' is-weekend' : ''}`}
          role="cell"
        />
      ))}
      <div
        className="gantt-bar"
        title={`${t.name}: 進捗 ${t.progress}%`}
        style={{
          gridColumn: `${FIXED_COLS + 1 + row.startOffset} / span ${row.duration}`,
          gridRow: 1,
          background: color,
          borderColor: color,
        }}
      >
        <span
          className="gantt-bar-progress"
          data-testid={`progress-${t.id}`}
          style={{ width: `${t.progress}%` }}
        />
        <span className="gantt-bar-label">{t.progress}%</span>
      </div>
    </div>
  );
}
