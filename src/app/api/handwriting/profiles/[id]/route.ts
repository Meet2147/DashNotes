import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import {
  MAX_PROFILE_BYTES,
  sanitizeGlyphMap,
  sanitizeMetrics,
  sanitizeName,
  sanitizeSettings,
} from '@/lib/handwriting/validate';

export const runtime = 'nodejs';

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const profile = await prisma.handwritingProfile.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: profile.id,
    name: profile.name,
    isDefault: profile.isDefault,
    glyphs: safeParse(profile.glyphs, {}),
    metrics: safeParse(profile.metrics, {}),
    settings: safeParse(profile.settings, {}),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  const owned = await prisma.handwritingProfile.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_PROFILE_BYTES) {
    return NextResponse.json({ error: 'That handwriting profile is too large.' }, { status: 413 });
  }
  const body = safeParse<Record<string, unknown>>(raw, {});

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = sanitizeName(body.name);
  if (body.metrics !== undefined) data.metrics = JSON.stringify(sanitizeMetrics(body.metrics));
  if (body.settings !== undefined) data.settings = JSON.stringify(sanitizeSettings(body.settings));

  if (body.glyphs !== undefined) {
    const glyphs = sanitizeGlyphMap(body.glyphs);
    if (Object.keys(glyphs).length === 0) {
      return NextResponse.json(
        { error: 'No usable glyphs were supplied — the profile was left unchanged.' },
        { status: 400 }
      );
    }
    data.glyphs = JSON.stringify(glyphs);
  }

  if (body.isDefault === true) {
    await prisma.handwritingProfile.updateMany({ where: { userId }, data: { isDefault: false } });
    data.isDefault = true;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const profile = await prisma.handwritingProfile.update({ where: { id }, data });
  return NextResponse.json({
    id: profile.id,
    name: profile.name,
    isDefault: profile.isDefault,
    updatedAt: profile.updatedAt,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  const profile = await prisma.handwritingProfile.findFirst({
    where: { id, userId },
    select: { id: true, isDefault: true },
  });
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.handwritingProfile.delete({ where: { id } });

  // Never leave the account without a default while it still has profiles.
  if (profile.isDefault) {
    const next = await prisma.handwritingProfile.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (next) {
      await prisma.handwritingProfile.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  return NextResponse.json({ success: true });
}
