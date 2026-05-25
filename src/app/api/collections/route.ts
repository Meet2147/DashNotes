import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 200 });
  const collections = await prisma.collection.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(collections);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, color } = await req.json();
  const col = await prisma.collection.create({ data: { name, color, userId: session.user.id } });
  return NextResponse.json(col);
}
