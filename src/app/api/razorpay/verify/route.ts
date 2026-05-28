import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await req.json();

  // Verify signature: HMAC SHA256 of "payment_id|subscription_id" with key_secret
  const payload = `${razorpay_payment_id}|${razorpay_subscription_id}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(payload)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Upgrade user to Pro
  await prisma.userPlan.upsert({
    where: { userId },
    update: { plan: 'pro', monthlyLimit: 10000, razorpaySubscriptionId: razorpay_subscription_id },
    create: { userId, plan: 'pro', monthlyLimit: 10000, razorpaySubscriptionId: razorpay_subscription_id },
  });

  // Mark referral as converted (if this user was referred)
  const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { referredBy: true } });
  if (userRecord?.referredBy) {
    await prisma.referral.updateMany({
      where: { referredId: userId, converted: false },
      data: { converted: true, convertedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
