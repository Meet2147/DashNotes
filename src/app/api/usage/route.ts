import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMonthlyUsage, getUserPlan } from '@/lib/usage';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ usage: 0, limit: 20 });
  const [usage, plan] = await Promise.all([
    getMonthlyUsage(session.user.id),
    getUserPlan(session.user.id),
  ]);
  return NextResponse.json({ usage, limit: plan?.monthlyLimit ?? 20, plan: plan?.plan ?? 'free' });
}
