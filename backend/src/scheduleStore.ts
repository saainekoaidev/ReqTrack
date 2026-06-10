import { prisma } from './db.js';
import { scheduleTasks, toDateKey } from './domain/schedule.js';
import { naturalWbsCompare } from './domain/estimate.js';
import { phaseRank } from './domain/phase.js';
import { getSettings } from './routes/settings.js';

// 見積(人日)・稼働率と祝日カレンダーから、稼働日ベースでタスクへ計画日を割り付けて永続化する。
// US-004 のガント初版生成ロジックを共通化し、/api/tasks/schedule と /api/projects/:id/ai-plan で再利用する。
export async function scheduleProject(
  projectId: string,
  startDate: string,
): Promise<{ scheduled: number }> {
  const [projectTasks, holidayRows, cfg] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
    prisma.holiday.findMany(),
    getSettings(),
  ]);
  const holidays = new Set(holidayRows.map((h) => toDateKey(h.date)));
  // 親(対象)の wbsId を引くマップ。グループ順の決定に使う。
  const wbsById = new Map(projectTasks.map((t) => [t.id, t.wbsId]));
  const groupWbs = (t: (typeof projectTasks)[number]): string | null =>
    (t.parentId ? wbsById.get(t.parentId) ?? null : null) ?? t.wbsId;
  // 効率化調整(負)と工数0の集約行(機能/対象)はバー対象外。
  // 並びは「対象(グループ)順 → 工程順 → WBS順」で、前工程→後工程の時系列で流す (US-045)。
  const schedulable = projectTasks
    .filter((t) => t.kind !== 'efficiency' && t.estimateDays > 0)
    .sort((a, b) => {
      const g = naturalWbsCompare(groupWbs(a), groupWbs(b));
      if (g !== 0) return g;
      const p = phaseRank(a.phase) - phaseRank(b.phase);
      if (p !== 0) return p;
      return naturalWbsCompare(a.wbsId, b.wbsId);
    });
  const scheduled = scheduleTasks(
    schedulable.map((t) => ({
      id: t.id,
      estimateDays: t.estimateDays,
      utilizationRate: t.utilizationRate,
      // 依存: 同一対象(親)配下を工程順に直列。要員: 同一担当を直列。
      groupKey: t.parentId ?? undefined,
      resourceKey: t.assigneeId ?? undefined,
      // 進捗のあるタスクは開始を固定(再生成で未来へ動かさない) (US-042)
      progress: t.progress,
      fixedStart: t.plannedStart,
      fixedEnd: t.plannedEnd,
    })),
    new Date(`${startDate}T00:00:00.000Z`),
    holidays,
    cfg.hoursPerDay,
  );
  await prisma.$transaction(
    scheduled.map((s) =>
      prisma.task.update({
        where: { id: s.id },
        data: { plannedStart: s.plannedStart, plannedEnd: s.plannedEnd },
      }),
    ),
  );
  return { scheduled: scheduled.length };
}
