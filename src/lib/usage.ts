import { prisma } from './prisma';

export async function getMonthlyUsage(userId: string): Promise<number> {
  const start = new Date();
  start.setDate(1); start.setHours(0, 0, 0, 0);
  return prisma.aiUsage.count({
    where: { userId, createdAt: { gte: start } },
  });
}

export async function getUserPlan(userId: string) {
  return prisma.userPlan.findUnique({ where: { userId } });
}

export async function canUseAI(userId: string): Promise<boolean> {
  const [usage, plan] = await Promise.all([getMonthlyUsage(userId), getUserPlan(userId)]);
  const limit = plan?.monthlyLimit ?? 20;
  return usage < limit;
}

export async function incrementUsage(userId: string, feature: string) {
  await prisma.aiUsage.create({ data: { userId, feature } });
}
