import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  await supabase
    .from('user_plans')
    .upsert({
      user_id: user.id,
      plan: 'pro',
      monthly_limit: 10000,
      razorpay_subscription_id,
      updated_at: new Date().toISOString(),
    });

  return NextResponse.json({ success: true });
}
