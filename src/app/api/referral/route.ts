import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  // Get user's referral code; generate one if missing
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  let code = user?.referralCode ?? '';
  if (!code) {
    const { nanoid } = await import('nanoid');
    code = nanoid(8);
    await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
  }

  const referrals = await prisma.referral.findMany({ where: { referrerId: userId } });
  const converted = referrals.filter((r) => r.converted);
  const paidOut = referrals.filter((r) => r.paidOut);

  return NextResponse.json({
    code,
    referralUrl: `${process.env.NEXTAUTH_URL ?? ''}/login?ref=${code}`,
    totalReferrals: referrals.length,
    convertedReferrals: converted.length,
    totalEarnings: converted.length * 100,
    paidOutEarnings: paidOut.length * 100,
    pendingPayout: (converted.length - paidOut.length) * 100,
  });
}
