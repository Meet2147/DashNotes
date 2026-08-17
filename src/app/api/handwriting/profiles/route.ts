import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import {
  MAX_PROFILE_BYTES,
  glyphCount,
  sanitizeGlyphMap,
  sanitizeMetrics,
  sanitizeName,
  sanitizeSettings,
} from '@/lib/handwriting/validate';
import type { GlyphMap } from '@/lib/handwriting/types';

export const runtime = 'nodejs';

/** How many handwriting profiles one account may keep. */
const MAX_PROFILES = 8;

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profiles = await prisma.handwritingProfile.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });

  return NextResponse.json(
    profiles.map((p: typeof profiles[0]) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      glyphCount: glyphCount(safeParse<GlyphMap>(p.glyphs, {})),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const raw = await req.text();
  if (raw.length > MAX_PROFILE_BYTES) {
    return NextResponse.json({ error: 'That handwriting profile is too large.' }, { status: 413 });
  }

  const body = safeParse<Record<string, unknown>>(raw, {});
  const glyphs = sanitizeGlyphMap(body.glyphs);
  if (Object.keys(glyphs).length === 0) {
    return NextResponse.json(
      { error: 'No usable glyphs were supplied — capture at least one character first.' },
      { status: 400 }
    );
  }

  const existing = await prisma.handwritingProfile.count({ where: { userId } });
  if (existing >= MAX_PROFILES) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_PROFILES} handwriting profiles. Delete one to add another.` },
      { status: 409 }
    );
  }

  // The first profile a user creates is their default, so the composer has
  // something selected without them having to choose.
  const isDefault = body.isDefault === true || existing === 0;
  if (isDefault) {
    await prisma.handwritingProfile.updateMany({ where: { userId }, data: { isDefault: false } });
  }

  const profile = await prisma.handwritingProfile.create({
    data: {
      userId,
      name: sanitizeName(body.name),
      isDefault,
      glyphs: JSON.stringify(glyphs),
      metrics: JSON.stringify(sanitizeMetrics(body.metrics)),
      settings: JSON.stringify(sanitizeSettings(body.settings)),
    },
  });

  return NextResponse.json({
    id: profile.id,
    name: profile.name,
    isDefault: profile.isDefault,
    glyphCount: glyphCount(glyphs),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  });
}
