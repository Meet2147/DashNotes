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

  await incrementUsage(userId, 'quiz');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `Generate 8-10 multiple choice quiz questions from these notes. Return ONLY valid JSON array with no other text:
[{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}]

The "correct" field is the 0-based index of the correct option in the "options" array.

Notes:
${noteContent}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 });
  }

  try {
    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });
    }
    const quiz = JSON.parse(jsonMatch[0]);
    return NextResponse.json(quiz);
  } catch {
    return NextResponse.json({ error: 'Failed to parse quiz' }, { status: 500 });
  }
}
