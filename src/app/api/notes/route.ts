import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const trash = req.nextUrl.searchParams.get('trash') === 'true';

  const notes = await prisma.note.findMany({
    where: {
      userId: session.user.id,
      deletedAt: trash ? { not: null } : null,
    },
    orderBy: trash
      ? [{ deletedAt: 'desc' }]
      : [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    include: { collection: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(notes.map((n: typeof notes[0]) => ({
    ...n,
    tags: JSON.parse(n.tags),
    content: JSON.parse(n.content),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const note = await prisma.note.create({
    data: {
      userId: session.user.id,
      title: body.title ?? 'Untitled',
      content: JSON.stringify(body.content ?? []),
      tags: JSON.stringify(body.tags ?? []),
      color: body.color ?? '#F3E8FF',
      collectionId: body.collectionId ?? null,
    },
  });
  return NextResponse.json({ ...note, tags: JSON.parse(note.tags), content: JSON.parse(note.content) });
}
