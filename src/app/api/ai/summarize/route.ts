import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { anthropic } from '@/lib/anthropic';
import { canUseAI, incrementUsage } from '@/lib/usage';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const allowed = await canUseAI(userId);
  if (!allowed) {
    return NextResponse.json({ error: 'limit_reached' }, { status: 429 });
  }

  const { noteContent } = await req.json();

  if (!noteContent || noteContent.trim().length === 0) {
    return NextResponse.json({ error: 'No note content provided' }, { status: 400 });
  }

  await incrementUsage(userId, 'summarize');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Summarize these notes as 3-5 clear bullet points in markdown format. Start each bullet with "- ". Focus on the key concepts and most important takeaways. Be concise.\n\nNotes:\n${noteContent}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }

  return NextResponse.json({ summary: textBlock.text });
}
