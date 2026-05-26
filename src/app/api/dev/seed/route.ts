import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// One-time seed endpoint — creates a test account with sample data
// DELETE this route before going to production with real users

const TEST_EMAIL = 'test@dashnotes.app';
const TEST_PASSWORD = 'DashNotes@123';

const SAMPLE_NOTES = [
  {
    title: 'Welcome to DashNotes 👋',
    color: '#F3E8FF',
    content: JSON.stringify([
      { id: '1', type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Welcome to DashNotes', styles: {} }], children: [] },
      { id: '2', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'DashNotes is your AI-powered learning notebook. Here\'s what you can do:', styles: {} }], children: [] },
      { id: '3', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Write notes with the block editor — type / for commands', styles: {} }], children: [] },
      { id: '4', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Ask Feynman AI to explain anything in your notes', styles: {} }], children: [] },
      { id: '5', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Generate flashcards and quizzes from your notes', styles: {} }], children: [] },
      { id: '6', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Organise notes into colour-coded Collections', styles: {} }], children: [] },
    ]),
    tags: JSON.stringify(['welcome', 'guide']),
    pinned: true,
  },
  {
    title: 'Quantum Mechanics — Study Notes',
    color: '#DBEAFE',
    content: JSON.stringify([
      { id: '1', type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Quantum Mechanics', styles: {} }], children: [] },
      { id: '2', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: "Heisenberg's Uncertainty Principle", styles: {} }], children: [] },
      { id: '3', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'The uncertainty principle states that the position and momentum of a particle cannot both be precisely determined at the same time. The more precisely position is known, the less precisely momentum can be known, and vice versa.', styles: {} }], children: [] },
      { id: '4', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Mathematically: Δx · Δp ≥ ℏ/2, where ℏ is the reduced Planck constant.', styles: { bold: true } }], children: [] },
      { id: '5', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: "Schrödinger's Equation", styles: {} }], children: [] },
      { id: '6', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'The Schrödinger equation describes how the quantum state of a physical system changes over time. It is the quantum mechanics analogue of Newton\'s second law in classical mechanics.', styles: {} }], children: [] },
      { id: '7', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Wave-Particle Duality', styles: {} }], children: [] },
      { id: '8', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Light and matter exhibit properties of both waves and particles. The double-slit experiment demonstrates this: electrons create an interference pattern (wave behavior) but are detected as individual particles.', styles: {} }], children: [] },
    ]),
    tags: JSON.stringify(['physics', 'exam-prep']),
    pinned: false,
  },
  {
    title: 'Machine Learning Fundamentals',
    color: '#D1FAE5',
    content: JSON.stringify([
      { id: '1', type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Machine Learning Fundamentals', styles: {} }], children: [] },
      { id: '2', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Supervised vs Unsupervised Learning', styles: {} }], children: [] },
      { id: '3', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Supervised learning uses labelled training data to learn a mapping from inputs to outputs. Examples: classification, regression.', styles: {} }], children: [] },
      { id: '4', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Unsupervised learning finds hidden patterns in unlabelled data. Examples: clustering, dimensionality reduction.', styles: {} }], children: [] },
      { id: '5', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Gradient Descent', styles: {} }], children: [] },
      { id: '6', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'An optimisation algorithm that iteratively moves in the direction of steepest descent to minimise a loss function. Learning rate controls step size.', styles: {} }], children: [] },
      { id: '7', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Overfitting & Regularisation', styles: {} }], children: [] },
      { id: '8', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Overfitting occurs when a model learns training data too well, failing to generalise. Techniques to prevent: L1/L2 regularisation, dropout, early stopping, cross-validation.', styles: {} }], children: [] },
    ]),
    tags: JSON.stringify(['ml', 'ai', 'exam-prep']),
    pinned: false,
  },
  {
    title: 'Product Ideas 💡',
    color: '#FFF3CD',
    content: JSON.stringify([
      { id: '1', type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Product Ideas', styles: {} }], children: [] },
      { id: '2', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'AI-powered flashcard generator from lecture slides', styles: {} }], children: [] },
      { id: '3', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'YouTube lecture → structured notes converter', styles: {} }], children: [] },
      { id: '4', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Collaborative study rooms with shared notes', styles: {} }], children: [] },
      { id: '5', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Spaced repetition reminders for flashcard review', styles: {} }], children: [] },
      { id: '6', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Mobile app with offline mode', styles: {} }], children: [] },
    ]),
    tags: JSON.stringify(['ideas', 'product']),
    pinned: false,
  },
];

export async function GET() {
  try {
    // Check if already seeded
    const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (existing) {
      return NextResponse.json({
        message: 'Already seeded!',
        credentials: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });
    }

    // Create test user
    const hashed = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, password: hashed, name: 'Test User' },
    });

    // Pro plan
    await prisma.userPlan.create({
      data: { userId: user.id, plan: 'pro', monthlyLimit: 10000 },
    });

    // Collections
    const [studyCol, ideasCol] = await Promise.all([
      prisma.collection.create({ data: { userId: user.id, name: 'Study Notes', color: '#3B82F6' } }),
      prisma.collection.create({ data: { userId: user.id, name: 'Ideas', color: '#F59E0B' } }),
    ]);

    // Notes
    await Promise.all(SAMPLE_NOTES.map((n, i) =>
      prisma.note.create({
        data: {
          userId: user.id,
          title: n.title,
          content: n.content,
          tags: n.tags,
          color: n.color,
          pinned: n.pinned,
          collectionId: i === 1 || i === 2 ? studyCol.id : i === 3 ? ideasCol.id : null,
        },
      })
    ));

    return NextResponse.json({
      success: true,
      message: 'Test account created with sample notes!',
      credentials: { email: TEST_EMAIL, password: TEST_PASSWORD },
      plan: 'Pro (unlimited AI)',
      collections: ['Study Notes', 'Ideas'],
      notes: SAMPLE_NOTES.map(n => n.title),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[seed error]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
