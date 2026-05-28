import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, referralCode } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Check DB is reachable
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not set');
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    if (!process.env.NEXTAUTH_SECRET) {
      console.error('NEXTAUTH_SECRET is not set');
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name || email.split('@')[0] },
    });

    await prisma.userPlan.create({ data: { userId: user.id } });

    // Generate a unique referral code for the new user
    const { nanoid } = await import('nanoid');
    const newCode = nanoid(8);
    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: newCode, referredBy: referralCode ?? null },
    });

    // Track referral if referralCode was provided
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) {
        await prisma.referral.create({
          data: { referrerId: referrer.id, referredId: user.id },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[signup error]', message);
    // Surface a readable error in development, generic in production
    const body = process.env.NODE_ENV === 'development'
      ? { error: message }
      : { error: 'Signup failed. Check server logs.' };
    return NextResponse.json(body, { status: 500 });
  }
}
