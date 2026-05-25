import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID ?? 'rzp_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET ?? 'placeholder',
  });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check they're not already Pro
  const { data: plan } = await supabase
    .from('user_plans')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  if (plan?.plan === 'pro') {
    return NextResponse.json({ error: 'Already Pro' }, { status: 400 });
  }

  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID!,
    customer_notify: 1,
    total_count: 12, // 12 months
    notes: {
      user_id: user.id,
      email: user.email ?? '',
    },
  });

  return NextResponse.json({ subscription_id: subscription.id });
}
