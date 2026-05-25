import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

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
  const supabase = await createClient();

  switch (event.event) {
    case 'subscription.activated':
    case 'subscription.charged': {
      const sub = event.payload.subscription.entity;
      const userId = sub.notes?.user_id;
      if (userId) {
        await supabase.from('user_plans').upsert({
          user_id: userId,
          plan: 'pro',
          monthly_limit: 10000,
          razorpay_subscription_id: sub.id,
          updated_at: new Date().toISOString(),
        });
      }
      break;
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      const sub = event.payload.subscription.entity;
      const userId = sub.notes?.user_id;
      if (userId) {
        await supabase.from('user_plans').update({
          plan: 'free',
          monthly_limit: 20,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
