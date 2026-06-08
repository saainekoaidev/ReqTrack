import { prisma } from './db.js';
import { scheduleTasks, toDateKey } from './domain/schedule.js';
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
  // 効率化調整(負)と工数0の集約行(機能/対象)はバー対象外
  const schedulable = projectTasks.filter((t) => t.kind !== 'efficiency' && t.estimateDays > 0);
  const scheduled = scheduleTasks(
    schedulable.map((t) => ({
      id: t.id,
      estimateDays: t.estimateDays,
      utilizationRate: t.utilizationRate,
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
