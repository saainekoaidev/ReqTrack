import ExcelJS from 'exceljs';
import { summarizeEstimate, naturalWbsCompare } from './domain/estimate.js';

// 見積 Excel(.xlsx) の生成 (US-016)。DB 非依存(入力データを受け取るだけ)。
// シート構成: 見積(諸元+根拠サマリ) / WBS / ガント。ce2 のシート構成に倣う。

export interface ExcelTask {
  wbsId: string | null;
  name: string;
  level: number;
  phase: string | null;
  estimateDays: number;
  utilizationRate: number;
  kind: string;
  assigneeName: string | null;
  estimateNote: string | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  progress: number;
}

export interface EstimateWorkbookInput {
  projectName: string;
  startDate?: string | null;
  tasks: ExcelTask[];
  holidays: ReadonlySet<string>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

function phaseArgb(phase: string | null): string {
  const table: [string, string][] = [
    ['レビュー', 'FFFFF3BF'],
    ['基本設計', 'FFA5D8FF'],
    ['詳細設計', 'FFB2F2BB'],
    ['コーディング', 'FFFFD8A8'],
    ['実装', 'FFFFD8A8'],
    ['単体テスト', 'FFFCC2D7'],
    ['結合テスト', 'FFD0BFFF'],
  ];
  if (phase) for (const [m, c] of table) if (phase.includes(m)) return c;
  return 'FFCED4DA';
}

function fill(cell: ExcelJS.Cell, argb: string): void {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function mmdd(d: Date | null): string {
  return d ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : '';
}

export function buildEstimateWorkbook(input: EstimateWorkbookInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ReqTrack';

  buildEstimateSheet(wb, input);
  buildWbsSheet(wb, input);
  buildGanttSheet(wb, input);

  return wb;
}

function buildEstimateSheet(wb: ExcelJS.Workbook, input: EstimateWorkbookInput): void {
  const ws = wb.addWorksheet('見積');
  ws.columns = [{ width: 24 }, { width: 16 }, { width: 40 }];

  ws.addRow([`見積書: ${input.projectName}`]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);

  ws.addRow(['■ 見積諸元']).font = { bold: true };
  ws.addRow(['1日の作業時間', '8 時間']);
  ws.addRow(['工数の単位', '人日(小数自由値)']);
  ws.addRow(['稼働率の考え方', '期間(営業日) = 工数 ÷ 稼働率']);
  ws.addRow(['レビュー工数', '対象工程 × 0.3(下限 0.25人日)']);
  ws.addRow(['効率化調整', '複数機能同時実施の重複削減(負の工数)']);
  ws.addRow(['非稼働日', '土日・祝日(マスタ登録)']);
  ws.addRow(['開始日', input.startDate ?? '(未設定)']);
  ws.addRow([]);

  const summary = summarizeEstimate(
    input.tasks.map((t) => ({
      phase: t.phase,
      estimateDays: t.estimateDays,
      kind: t.kind,
      assigneeName: t.assigneeName,
    })),
  );

  ws.addRow(['■ 工程別工数(人日)']).font = { bold: true };
  for (const p of summary.byPhase) ws.addRow([p.phase, p.days]);
  ws.addRow([]);

  ws.addRow(['■ 担当者別工数(人日)']).font = { bold: true };
  for (const a of summary.byAssignee) ws.addRow([a.name, a.days]);
  ws.addRow([]);

  ws.addRow(['小計(作業+レビュー)', summary.subtotal]);
  ws.addRow(['効率化調整', summary.efficiency]);
  const totalRow = ws.addRow(['総計', summary.total]);
  totalRow.font = { bold: true };
}

function buildWbsSheet(wb: ExcelJS.Workbook, input: EstimateWorkbookInput): void {
  const ws = wb.addWorksheet('WBS');
  const header = ['No', '機能/対象/作業', '工程', '工数(人日)', '稼働率', '担当者', '工数推定理由'];
  ws.addRow(header).font = { bold: true };
  ws.columns = [
    { width: 8 },
    { width: 40 },
    { width: 16 },
    { width: 10 },
    { width: 8 },
    { width: 14 },
    { width: 44 },
  ];

  const sorted = [...input.tasks].sort((a, b) => naturalWbsCompare(a.wbsId, b.wbsId));
  let no = 1;
  for (const t of sorted) {
    const indent = '  '.repeat(Math.max(0, (t.level ?? 3) - 1));
    const row = ws.addRow([
      t.wbsId ?? no,
      `${indent}${t.name}`,
      t.phase ?? '',
      t.estimateDays,
      t.kind === 'efficiency' ? '' : `${Math.round((t.utilizationRate ?? 1) * 100)}%`,
      t.assigneeName ?? '',
      t.estimateNote ?? '',
    ]);
    if (t.phase) fill(row.getCell(3), phaseArgb(t.phase));
    if (t.level === 1) row.font = { bold: true };
    if (t.kind === 'efficiency') row.getCell(4).font = { color: { argb: 'FFDC2626' } };
    no += 1;
  }
}

function buildGanttSheet(wb: ExcelJS.Workbook, input: EstimateWorkbookInput): void {
  const ws = wb.addWorksheet('ガント');
  const FIXED = ['No', 'WBS', '作業タスク', '工程', '工数', '担当者', '開始', '終了'];

  const scheduled = input.tasks
    .filter((t) => t.plannedStart && t.plannedEnd && t.kind !== 'efficiency' && t.estimateDays > 0)
    .sort((a, b) => naturalWbsCompare(a.wbsId, b.wbsId));

  if (scheduled.length === 0) {
    ws.addRow(['計画日が設定されたタスクがありません(ガントを生成してください)']);
    return;
  }

  const min = new Date(Math.min(...scheduled.map((t) => t.plannedStart!.getTime())));
  const max = new Date(Math.max(...scheduled.map((t) => t.plannedEnd!.getTime())));
  const totalDays = Math.round((max.getTime() - min.getTime()) / DAY_MS) + 1;
  const days = Array.from({ length: totalDays }, (_, i) => new Date(min.getTime() + i * DAY_MS));

  // 列幅
  ws.columns = [
    { width: 6 },
    { width: 10 },
    { width: 28 },
    { width: 14 },
    { width: 7 },
    { width: 12 },
    { width: 7 },
    { width: 7 },
    ...days.map(() => ({ width: 3.5 })),
  ];

  // 1段目: 固定列見出し空き + 月マージ
  const row1 = ws.addRow([...FIXED.map(() => ''), ...days.map((d) => `${d.getUTCMonth() + 1}月`)]);
  // 月セルを連続範囲でマージ
  let seg = FIXED.length + 1;
  for (let i = 1; i <= days.length; i++) {
    const cur = days[i - 1]!.getUTCMonth();
    const next = i < days.length ? days[i]!.getUTCMonth() : -1;
    if (next !== cur) {
      const startCol = seg;
      const endCol = FIXED.length + i;
      if (endCol > startCol) ws.mergeCells(row1.number, startCol, row1.number, endCol);
      seg = endCol + 1;
    }
  }

  // 2段目: 固定見出し + 日(曜日)
  const row2 = ws.addRow([...FIXED, ...days.map((d) => `${d.getUTCDate()}\n${WEEKDAY_JA[d.getUTCDay()]}`)]);
  row2.font = { bold: true };
  row2.alignment = { wrapText: true, horizontal: 'center' };
  days.forEach((d, i) => {
    const isOff = d.getUTCDay() === 0 || d.getUTCDay() === 6 || input.holidays.has(dateKey(d));
    if (isOff) fill(row2.getCell(FIXED.length + 1 + i), 'FFEFEFEF');
  });

  // タスク行
  let no = 1;
  for (const t of scheduled) {
    const row = ws.addRow([
      no,
      t.wbsId ?? '',
      t.name,
      t.phase ?? '',
      t.estimateDays,
      t.assigneeName ?? '',
      mmdd(t.plannedStart),
      mmdd(t.plannedEnd),
    ]);
    const argb = phaseArgb(t.phase);
    const s = t.plannedStart!.getTime();
    const e = t.plannedEnd!.getTime();
    days.forEach((d, i) => {
      const col = FIXED.length + 1 + i;
      const isOff = d.getUTCDay() === 0 || d.getUTCDay() === 6 || input.holidays.has(dateKey(d));
      if (d.getTime() >= s && d.getTime() <= e) {
        fill(row.getCell(col), argb);
      } else if (isOff) {
        fill(row.getCell(col), 'FFF5F5F5');
      }
    });
    no += 1;
  }

  ws.views = [{ state: 'frozen', xSplit: FIXED.length, ySplit: 2 }];
}
