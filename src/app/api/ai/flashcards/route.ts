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

  await incrementUsage(userId, 'flashcards');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Generate 10-12 flashcards from these notes. Return ONLY valid JSON array with no other text: [{"front": "question", "back": "answer"}]\n\nNotes:\n${noteContent}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 500 });
  }

  try {
    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });
    }
    const flashcards = JSON.parse(jsonMatch[0]);
    return NextResponse.json(flashcards);
  } catch {
    return NextResponse.json({ error: 'Failed to parse flashcards' }, { status: 500 });
  }
}
