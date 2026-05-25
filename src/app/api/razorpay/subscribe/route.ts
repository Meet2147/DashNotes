import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID ?? 'rzp_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET ?? 'placeholder',
  });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const plan = await prisma.userPlan.findUnique({ where: { userId } });
  if (plan?.plan === 'pro') {
    return NextResponse.json({ error: 'Already Pro' }, { status: 400 });
  }

  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID!,
    customer_notify: 1,
    total_count: 12, // 12 months
    notes: {
      user_id: userId,
      email: session.user.email ?? '',
    },
  });

  return NextResponse.json({ subscription_id: subscription.id });
}
