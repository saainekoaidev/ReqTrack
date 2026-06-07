// 柔軟な取込のパース (US-019)。DB 非依存・LLM 非依存のヒューリスティック。
// テンプレ(ヘッダ別名で列特定)を優先し、無ければ自由体裁(最長セル)/自然文にフォールバック。

/** 自然文を要件セグメントへ分割する。改行 / 箇条書き(・-*•) / 句点「。」で割る。 */
export function splitNaturalText(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|。/)
    .map((s) => s.replace(/^[\s　]*[-*・•\d.]+[\s　]*/, '').trim())
    .filter((s) => s.length > 0);
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s　()（）]/g, '');
}

const REQUIREMENT_ALIASES = ['要件', '内容', '改修', '概要', '詳細', 'requirement', 'content', 'description'];

/** ヘッダ行から要件本文の列インデックスを推定(別名照合)。見つからなければ -1。 */
export function detectRequirementColumn(headers: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (let i = 0; i < norm.length; i++) {
    if (REQUIREMENT_ALIASES.some((a) => norm[i]!.includes(a.toLowerCase()))) return i;
  }
  return -1;
}

const looksLikeNumber = (s: string) => s !== '' && !Number.isNaN(Number(s));

/**
 * 表(行=セル配列、先頭行はヘッダ想定)から要件本文を抽出する。
 * - ヘッダに要件列があればその列を採用(テンプレ=高精度)
 * - 無ければ各行で最長の非数値テキストセルを採用(自由体裁=低精度)
 */
export function extractRequirements(rows: string[][]): string[] {
  if (rows.length === 0) return [];
  const headers = rows[0]!;
  const col = detectRequirementColumn(headers);
  const out: string[] = [];

  if (col >= 0) {
    for (let r = 1; r < rows.length; r++) {
      const v = (rows[r]![col] ?? '').trim();
      if (v) out.push(v);
    }
    return out;
  }

  // フォールバック: ヘッダ行も含め、各行で最長の非数値セルを採用
  for (const row of rows) {
    let best = '';
    for (const cell of row) {
      const c = (cell ?? '').trim();
      if (!looksLikeNumber(c) && c.length > best.length) best = c;
    }
    if (best && best.length >= 2) out.push(best);
  }
  // 先頭がヘッダっぽい語のみなら除去はしない(割り切り)。重複除去のみ。
  return [...new Set(out)];
}

export interface EstimateRowSpec {
  wbsId?: string;
  name: string;
  phase?: string;
  estimateDays?: number;
  utilizationRate?: number;
  assigneeName?: string;
  estimateNote?: string;
}

const ESTIMATE_ALIASES: Record<keyof Omit<EstimateRowSpec, never>, string[]> = {
  wbsId: ['wbs', 'no', '番号', '#'],
  name: ['タスク', '作業', '名称', '項目', 'name', 'task'],
  phase: ['工程', 'フェーズ', 'phase'],
  estimateDays: ['工数', '人日', '見積', 'days', 'effort'],
  utilizationRate: ['稼働率', 'utilization', 'rate'],
  assigneeName: ['担当', 'assignee', 'owner'],
  estimateNote: ['根拠', '理由', '備考', 'note', 'reason'],
};

/** ヘッダ行から各フィールドの列インデックスを解決する。 */
export function mapEstimateHeaders(headers: string[]): Partial<Record<keyof EstimateRowSpec, number>> {
  const norm = headers.map(normalizeHeader);
  const map: Partial<Record<keyof EstimateRowSpec, number>> = {};
  (Object.keys(ESTIMATE_ALIASES) as (keyof EstimateRowSpec)[]).forEach((field) => {
    for (let i = 0; i < norm.length; i++) {
      if (ESTIMATE_ALIASES[field].some((a) => norm[i]!.includes(a.toLowerCase()))) {
        if (map[field] === undefined) map[field] = i;
      }
    }
  });
  return map;
}

function parseRate(raw: string): number | undefined {
  const n = Number(raw.replace('%', ''));
  if (Number.isNaN(n)) return undefined;
  const r = raw.includes('%') || n > 1 ? n / 100 : n;
  if (r <= 0) return undefined;
  return Math.min(1, Math.round(r * 1000) / 1000);
}

/**
 * 見積明細の表からタスク仕様を抽出する。name 列(または最長セル)が無い行はスキップ。
 */
export function parseEstimateRows(rows: string[][]): EstimateRowSpec[] {
  if (rows.length === 0) return [];
  const headers = rows[0]!;
  const map = mapEstimateHeaders(headers);
  const out: EstimateRowSpec[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const cell = (i: number | undefined) => (i === undefined ? '' : (row[i] ?? '').trim());

    let name = cell(map.name);
    if (!name) {
      // name 列が無ければ最長の非数値セルを名称に
      let best = '';
      for (const c of row) {
        const v = (c ?? '').trim();
        if (!looksLikeNumber(v) && v.length > best.length) best = v;
      }
      name = best;
    }
    if (!name) continue;

    const estRaw = cell(map.estimateDays);
    const utilRaw = cell(map.utilizationRate);
    out.push({
      wbsId: cell(map.wbsId) || undefined,
      name,
      phase: cell(map.phase) || undefined,
      estimateDays: looksLikeNumber(estRaw) ? Math.max(0, Number(estRaw)) : undefined,
      utilizationRate: utilRaw ? parseRate(utilRaw) : undefined,
      assigneeName: cell(map.assigneeName) || undefined,
      estimateNote: cell(map.estimateNote) || undefined,
    });
  }
  return out;
}

/** ごく簡易な CSV パーサ(ダブルクオート対応、カンマ区切り)。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // skip
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
