import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 動作確認用の最小シードデータ。
async function main() {
  const member = await prisma.member.upsert({
    where: { email: 'taro@example.com' },
    update: {},
    create: { name: '山田 太郎', role: 'SE', email: 'taro@example.com' },
  });

  await prisma.holiday.upsert({
    where: { date: new Date('2026-01-01T00:00:00.000Z') },
    update: {},
    create: { date: new Date('2026-01-01T00:00:00.000Z'), name: '元日' },
  });

  const project = await prisma.project.create({
    data: { name: 'サンプル案件', description: '初期構成の動作確認用' },
  });

  const requirement = await prisma.requirement.create({
    data: { projectId: project.id, content: 'ログイン機能が欲しい', source: 'hearing' },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      requirementId: requirement.id,
      name: 'ログイン画面 実装',
      estimateDays: 3,
      plannedStart: new Date('2026-06-01T00:00:00.000Z'),
      plannedEnd: new Date('2026-06-05T00:00:00.000Z'),
      progress: 20,
      assigneeId: member.id,
    },
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
