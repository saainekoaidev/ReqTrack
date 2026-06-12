import { useState } from 'react';
import type { Member, Task } from '../api/client';
import { workerCandidates } from '../lib/roles';
import {
  buildGantt,
  workingTime,
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
  progress?: number;
};

// ガントチャート表示 (US-004 / US-015 / US-040)。
// 左に WBS 3階層(機能/対象/作業)の表(折り畳み可)、右に稼働時間軸の連続バー(小数日対応・コマ無し)。
// 表重視(全列) / チャート重視(No・タスク・進捗のみ。他は 0 幅で非表示) (US-057)
// 列: No / タスク / 工程 / 工数 / 稼働率 / 開始 / 終了 / 担当 / 予定 / 進捗 (US-059 で予定を追加)
const LEFT_COLS_FULL = '58px 200px 76px 82px 62px 84px 84px 80px 60px 64px';
const LEFT_WIDTH_FULL = 58 + 200 + 76 + 82 + 62 + 84 + 84 + 80 + 60 + 64; // = 850
const LEFT_COLS_CHART = '44px 150px 0 0 0 0 0 0 56px 58px';
const LEFT_WIDTH_CHART = 44 + 150 + 56 + 58; // = 308
// 工数/稼働率は 0.125 等の小数3位、進捗は 0.1% を入力できる刻み (US-054)
const EST_STEP = 0.001;
const UTIL_STEP = 0.001;
const PROG_STEP = 0.1;
const MIN_DAY_PX = 34;
const ROW_H = 28; // データ行の固定高さ(本日線/イナズマ線の座標計算に使う, US-051)

export default function GanttChart({
  tasks,
  holidays = new Set<string>(),
  hoursPerDay = 8,
  dayStartHour = 9,
  members,
  onPatch,
  today,
  slipDate,
}: {
  tasks: Task[];
  holidays?: ReadonlySet<string>;
  hoursPerDay?: number;
  dayStartHour?: number;
  /** インライン編集 (US-046)。指定すると葉行の 名称/工数/稼働率/担当 を編集できる。 */
  members?: Member[];
  onPatch?: (taskId: string, data: GanttPatch) => void;
  /** 本日線の日付 (US-051)。未指定なら描画しない。 */
  today?: Date | null;
  /** イナズマ線(実績進捗線)の基準日 (US-051)。未指定なら描画しない。 */
  slipDate?: Date | null;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [chartFocus, setChartFocus] = useState(false); // false=表重視(基本), true=チャート重視 (US-057)
  const leftCols = chartFocus ? LEFT_COLS_CHART : LEFT_COLS_FULL;
  const leftWidth = chartFocus ? LEFT_WIDTH_CHART : LEFT_WIDTH_FULL;
  const { rows, axis, totalWT, months, baseDay } = buildGantt(
    tasks,
    holidays,
    hoursPerDay,
    dayStartHour,
  );

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
  const ganttMinWidth = leftWidth + axis.length * MIN_DAY_PX;

  return (
    <div className="gantt2-card">
      <div className="gantt2-toolbar">
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => setChartFocus((v) => !v)}
          title={chartFocus ? '入力エリアを広げる' : 'チャートを広げる'}
        >
          {chartFocus ? '◀ 入力エリアを広く' : 'チャートを広く ▶'}
        </button>
      </div>
      <div
        className="gantt2"
        style={{ minWidth: ganttMinWidth }}
        role="table"
        aria-label="ガントチャート"
      >
        {/* 月ヘッダ */}
        <div className="g2-row g2-head">
          <div className="g2-left" style={{ gridTemplateColumns: leftCols }}>
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
          <div className="g2-left" style={{ gridTemplateColumns: leftCols }}>
            <div className="g2-cell">No</div>
            <div className="g2-cell">タスク</div>
            <div className="g2-cell">工程</div>
            <div className="g2-cell">工数(人日)</div>
            <div className="g2-cell">稼働率</div>
            <div className="g2-cell">開始</div>
            <div className="g2-cell">終了</div>
            <div className="g2-cell">担当</div>
            <div className="g2-cell" title="基準日時点の予定進捗率">予定</div>
            <div className="g2-cell">進捗</div>
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

        <div className="g2-body" style={{ position: 'relative' }}>
          {visible.map((row) => (
            <GanttRowView
              key={row.task.id}
              row={row}
              collapsed={collapsed.has(row.task.id)}
              onToggle={() => toggle(row.task.id)}
              totalWT={totalWT}
              members={members}
              onPatch={onPatch}
              leftCols={leftCols}
              slipDate={slipDate ?? null}
            />
          ))}
          <OverlayLines
            visible={visible}
            totalWT={totalWT}
            baseDay={baseDay}
            holidays={holidays}
            hoursPerDay={hoursPerDay}
            dayStartHour={dayStartHour}
            today={today ?? null}
            slipDate={slipDate ?? null}
            leftWidth={leftWidth}
          />
        </div>
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
  leftCols,
  slipDate,
}: {
  row: GanttRow;
  collapsed: boolean;
  onToggle: () => void;
  totalWT: number;
  members?: Member[];
  onPatch?: (taskId: string, data: GanttPatch) => void;
  leftCols: string;
  slipDate: Date | null;
}) {
  const t = row.task;
  const isLeaf = !row.hasChildren;
  // 基準日(イナズマ線の日)時点の予定進捗率 (US-059)
  const expectedPct = expectedProgressAt(row.startDate, row.endDate, slipDate);
  const editable = !!onPatch && isLeaf;
  const color = phaseColor(t.phase);
  const pctLeft = row.startWT != null ? (row.startWT / totalWT) * 100 : 0;
  const pctWidth =
    row.startWT != null && row.endWT != null
      ? Math.max(0.4, ((row.endWT - row.startWT) / totalWT) * 100)
      : 0;

  return (
    <div className="g2-row g2-data">
      <div className="g2-left" style={{ gridTemplateColumns: leftCols }}>
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
              step={EST_STEP}
              aria-label={`${t.wbsId ?? t.id} の工数`}
              defaultValue={t.estimateDays}
              onChange={(e) => {
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
              min={0.001}
              max={1}
              step={UTIL_STEP}
              aria-label={`${t.wbsId ?? t.id} の稼働率`}
              defaultValue={t.utilizationRate ?? 1}
              onChange={(e) => {
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
        <div className="g2-cell g2-num muted" title="基準日時点の予定進捗率">
          {expectedPct == null ? '' : `${expectedPct}%`}
        </div>
        <div className="g2-cell g2-num">
          {editable ? (
            <input
              type="number"
              min={0}
              max={100}
              step={PROG_STEP}
              aria-label={`${t.wbsId ?? t.id} の進捗率`}
              defaultValue={t.progress}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v) && v >= 0 && v <= 100 && v !== t.progress)
                  onPatch!(t.id, { progress: v });
              }}
              style={{ width: '100%' }}
            />
          ) : (
            `${row.progress}%`
          )}
        </div>
      </div>
      <div className="g2-chart">
        {row.startWT != null && (
          <div
            className={`g2-bar${isLeaf ? '' : ' is-summary'}`}
            title={`${t.name}: 進捗 ${row.progress}%`}
            style={{
              left: `${pctLeft}%`,
              width: `${pctWidth}%`,
              background: isLeaf ? color : undefined,
              borderColor: isLeaf ? color : undefined,
            }}
          >
            {(
              <>
                <span
                  className="g2-bar-progress"
                  data-testid={`progress-${t.id}`}
                  style={{ width: `${row.progress}%` }}
                />
                {isLeaf && <span className="g2-bar-label">{row.progress}%</span>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 本日線(縦線)とイナズマ線(実績進捗線)のオーバーレイ (US-051)。
// チャート領域(左カラムの右側)に重ね、行は固定高さ ROW_H 前提で y を算出する。
function OverlayLines({
  visible,
  totalWT,
  baseDay,
  holidays,
  hoursPerDay,
  dayStartHour,
  today,
  slipDate,
  leftWidth,
}: {
  visible: GanttRow[];
  totalWT: number;
  baseDay: Date | null;
  holidays: ReadonlySet<string>;
  hoursPerDay: number;
  dayStartHour: number;
  today: Date | null;
  slipDate: Date | null;
  leftWidth: number;
}) {
  if (!baseDay || totalWT <= 0) return null;
  const height = visible.length * ROW_H;
  const xOf = (wt: number) => Math.min(100, Math.max(0, (wt / totalWT) * 100)); // 0..100

  const todayWT = today ? workingTime(today, baseDay, holidays, hoursPerDay, dayStartHour) : null;
  // イナズマ線の基準は「その日の終了時点(右端)」= 稼働日インデックス + 1.0 (US-052)
  const slipWT =
    slipDate != null
      ? Math.floor(workingTime(slipDate, baseDay, holidays, hoursPerDay, dayStartHour)) + 1
      : null;

  // イナズマ線: 行境界で基準日(右端)へ戻り、各行で進捗バーの頂点へ向かうスパイク形 (US-052)
  let slipPoints = '';
  if (slipWT != null) {
    const sx = xOf(slipWT);
    const pts: string[] = [`${sx},0`];
    visible.forEach((row, i) => {
      const midY = i * ROW_H + ROW_H / 2;
      const bottomY = (i + 1) * ROW_H;
      let wt = slipWT;
      if (row.startWT != null && row.endWT != null) {
        // 進捗バーの頂点(達成位置)。
        const apex = row.startWT + (row.progress / 100) * (row.endWT - row.startWT);
        // 未開始(開始が基準日より後)かつ進捗0%は基準線に留め、右へ伸ばさない。
        // 進捗がある(>0)場合に限り、未開始でも右への突出を許容する (US-062)。
        const notStarted = row.startWT > slipWT;
        if (notStarted && row.progress <= 0) {
          wt = slipWT;
        } else {
          wt = apex;
        }
      }
      pts.push(`${xOf(wt)},${midY}`); // 進捗頂点へ
      pts.push(`${sx},${bottomY}`); // 次の行境界で基準日へ戻る
    });
    slipPoints = pts.join(' ');
  }

  return (
    <div
      className="g2-overlay"
      style={{ position: 'absolute', top: 0, left: leftWidth, right: 0, height, pointerEvents: 'none' }}
    >
      {/* viewBox 0..100 を幅へ、y は px。preserveAspectRatio none で x を全幅へ伸ばす。 */}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        {todayWT != null && todayWT >= 0 && todayWT <= totalWT && (
          <line
            x1={xOf(todayWT)}
            y1={0}
            x2={xOf(todayWT)}
            y2={height}
            className="g2-today-line"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {slipPoints && (
          <polyline points={slipPoints} className="g2-slip-line" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    </div>
  );
}

// 基準日時点の予定進捗率(%) を線形補間で算出する (US-059)。開始前=0、終了後=100。
function expectedProgressAt(
  startDate: Date | null,
  endDate: Date | null,
  slip: Date | null,
): number | null {
  if (!slip || !startDate || !endDate) return null;
  const s = startDate.getTime();
  const e = endDate.getTime();
  const t = slip.getTime();
  if (e <= s) return t >= e ? 100 : 0;
  if (t <= s) return 0;
  if (t >= e) return 100;
  return Math.round(((t - s) / (e - s)) * 1000) / 10;
}
