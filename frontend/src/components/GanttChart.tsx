import type { Task } from '../api/client';
import { buildGantt, dayLabel, isWeekend } from '../lib/gantt';

// ガントチャート表示 (US-004)。計画バーを日付軸上に描画する。
// 進捗率の反映は US-008 で progress バーを重ねる。
export default function GanttChart({ tasks }: { tasks: Task[] }) {
  const { days, rows } = buildGantt(tasks);

  if (rows.length === 0) {
    return <p className="muted">計画日が設定されたタスクがありません。「ガント初版を生成」してください。</p>;
  }

  const gridTemplate = `200px repeat(${days.length}, 28px)`;

  return (
    <div className="gantt" role="table" aria-label="ガントチャート">
      <div className="gantt-row gantt-head" role="row" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="gantt-cell gantt-name" role="columnheader">
          タスク
        </div>
        {days.map((d, i) => (
          <div
            key={i}
            className={`gantt-cell gantt-axis${isWeekend(d) ? ' is-weekend' : ''}`}
            role="columnheader"
          >
            {dayLabel(d)}
          </div>
        ))}
      </div>

      {rows.map((row) => (
        <div
          key={row.task.id}
          className="gantt-row"
          role="row"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="gantt-cell gantt-name" role="cell" title={row.task.name}>
            {row.task.name}
          </div>
          {days.map((d, i) => (
            <div
              key={i}
              className={`gantt-cell gantt-track${isWeekend(d) ? ' is-weekend' : ''}`}
              role="cell"
            />
          ))}
          <div
            className="gantt-bar"
            style={{
              gridColumn: `${row.startOffset + 2} / span ${row.duration}`,
              gridRow: 1,
            }}
          >
            <span className="gantt-bar-progress" style={{ width: `${row.task.progress}%` }} />
            <span className="gantt-bar-label">{row.task.progress}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
