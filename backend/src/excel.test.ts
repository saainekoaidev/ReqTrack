import { describe, it, expect } from 'vitest';
import { buildEstimateWorkbook, type ExcelTask } from './excel.js';

function task(p: Partial<ExcelTask> & { name: string }): ExcelTask {
  return {
    wbsId: null,
    level: 3,
    phase: null,
    estimateDays: 1,
    utilizationRate: 1,
    kind: 'task',
    assigneeName: null,
    estimateNote: null,
    plannedStart: null,
    plannedEnd: null,
    progress: 0,
    ...p,
  };
}

describe('buildEstimateWorkbook (US-016)', () => {
  it('見積/WBS/ガント の 3 シートを生成しバッファ化できる', async () => {
    const wb = buildEstimateWorkbook({
      projectName: '案件A',
      startDate: '2026-06-08',
      holidays: new Set(),
      tasks: [
        task({
          name: '基本設計',
          wbsId: '1.1',
          phase: '基本設計',
          estimateDays: 2,
          assigneeName: '山田',
          estimateNote: 'XX のため',
          plannedStart: new Date('2026-06-08T00:00:00Z'),
          plannedEnd: new Date('2026-06-09T00:00:00Z'),
        }),
        task({ name: '効率化調整', kind: 'efficiency', level: 1, estimateDays: -0.5 }),
      ],
    });

    expect(wb.worksheets.map((w) => w.name)).toEqual(['見積', 'WBS', 'ガント']);
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it('計画日が無ければガントは案内のみ', async () => {
    const wb = buildEstimateWorkbook({
      projectName: 'B',
      holidays: new Set(),
      tasks: [task({ name: '設計', estimateDays: 1 })],
    });
    const gantt = wb.getWorksheet('ガント');
    expect(gantt?.getCell('A1').value).toContain('計画日が設定されたタスクがありません');
  });
});
