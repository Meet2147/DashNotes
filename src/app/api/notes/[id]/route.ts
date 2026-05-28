import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const note = await prisma.note.findFirst({
    where: { id, userId: session.user.id },
    include: { collection: { select: { id: true, name: true, color: true } } },
  });
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...note, tags: JSON.parse(note.tags), content: JSON.parse(note.content) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // Handle restore
  if (body.restore === true) {
    const note = await prisma.note.updateMany({
      where: { id, userId: session.user.id },
      data: { deletedAt: null },
    });
    return NextResponse.json(note);
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.content !== undefined) data.content = JSON.stringify(body.content);
  if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);
  if (body.color !== undefined) data.color = body.color;
  if (body.pinned !== undefined) data.pinned = body.pinned;
  if (body.collectionId !== undefined) data.collectionId = body.collectionId;
  const note = await prisma.note.updateMany({ where: { id, userId: session.user.id }, data });
  return NextResponse.json(note);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const permanent = req.nextUrl.searchParams.get('permanent') === 'true';

  if (permanent) {
    await prisma.note.deleteMany({ where: { id, userId: session.user.id } });
  } else {
    // Soft delete
    await prisma.note.updateMany({
      where: { id, userId: session.user.id },
      data: { deletedAt: new Date() },
    });
  }
  return NextResponse.json({ success: true });
}
