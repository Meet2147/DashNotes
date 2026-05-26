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

  await incrementUsage(userId, 'summarize');

  const response = await getPerplexity().chat.completions.create({
    model: FAST_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Summarize these notes as 3-5 clear bullet points in markdown. Start each with "- ". Focus on key concepts and important takeaways. Be concise.\n\nNotes:\n${noteContent}`,
      },
    ],
  });

  const summary = response.choices[0]?.message?.content ?? '';
  return NextResponse.json({ summary });
}
