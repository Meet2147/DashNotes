import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  // Verify webhook signature
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (expected !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);

  switch (event.event) {
    case 'subscription.activated':
    case 'subscription.charged': {
      const sub = event.payload.subscription.entity;
      const userId = sub.notes?.user_id;
      if (userId) {
        await prisma.userPlan.upsert({
          where: { userId },
          update: { plan: 'pro', monthlyLimit: 10000, razorpaySubscriptionId: sub.id },
          create: { userId, plan: 'pro', monthlyLimit: 10000, razorpaySubscriptionId: sub.id },
        });
      }
      break;
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      const sub = event.payload.subscription.entity;
      const userId = sub.notes?.user_id;
      if (userId) {
        await prisma.userPlan.update({
          where: { userId },
          data: { plan: 'free', monthlyLimit: 20 },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
