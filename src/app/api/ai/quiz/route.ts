import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPerplexity, FAST_MODEL } from '@/lib/perplexity';
import { canUseAI, incrementUsage } from '@/lib/usage';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const allowed = await canUseAI(userId);
  if (!allowed) return NextResponse.json({ error: 'limit_reached' }, { status: 429 });

  const { noteContent } = await req.json();
  if (!noteContent?.trim()) return NextResponse.json({ error: 'No note content provided' }, { status: 400 });

  await incrementUsage(userId, 'quiz');

  const response = await getPerplexity().chat.completions.create({
    model: FAST_MODEL,
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `Generate 8-10 multiple choice quiz questions from these notes. Return ONLY a valid JSON array, no explanation:
[{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}]

"correct" is the 0-based index of the correct option.

Notes:
${noteContent}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });
    return NextResponse.json(JSON.parse(match[0]));
  } catch {
    return NextResponse.json({ error: 'Failed to parse quiz' }, { status: 500 });
  }
}
