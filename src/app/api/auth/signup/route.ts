import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { describeDbError } from '@/lib/dbHealth';

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
    const described = describeDbError(err);
    console.error('[signup error]', described.code, described.message);

    // Connection-level problems are operational, not sensitive, and hiding them
    // behind "check the server logs" is what made this hard to diagnose. Name
    // them; fall back to a generic message for anything else in production.
    if (described.code.startsWith('P1') || described.code === 'P2021') {
      return NextResponse.json(
        { error: `${described.message} See /api/health for details.` },
        { status: 503 }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    const body =
      process.env.NODE_ENV === 'development'
        ? { error: message }
        : { error: 'Signup failed. Check /api/health and the server logs.' };
    return NextResponse.json(body, { status: 500 });
  }
}
