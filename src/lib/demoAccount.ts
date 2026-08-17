/**
 * Server-side demo account: the gate, and creating/repairing the account.
 *
 * Read at *runtime* from ENABLE_DEMO_LOGIN, not baked in at build time, so
 * setting it in a hosting dashboard works without a rebuild. It defaults to
 * enabled and is closed only by an explicit "false" — the endpoint it guards was
 * previously wide open, so defaulting off would silently lock people out of the
 * one route that can create the account.
 *
 * Set ENABLE_DEMO_LOGIN=false before the app has real users.
 */

import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { DEMO_EMAIL, DEMO_PASSWORD } from './demo';

export function demoEnabled(): boolean {
  return process.env.ENABLE_DEMO_LOGIN !== 'false';
}

const SAMPLE_NOTES = [
  {
    title: 'Welcome to DashNotes 👋',
    color: '#F3E8FF',
    content: JSON.stringify([
      { id: '1', type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Welcome to DashNotes', styles: {} }], children: [] },
      { id: '2', type: 'paragraph', props: {}, content: [{ type: 'text', text: "DashNotes is your AI-powered learning notebook. Here's what you can do:", styles: {} }], children: [] },
      { id: '3', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Write notes with the block editor — type / for commands', styles: {} }], children: [] },
      { id: '4', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Ask Feynman AI to explain anything in your notes', styles: {} }], children: [] },
      { id: '5', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Generate flashcards and quizzes from your notes', styles: {} }], children: [] },
      { id: '6', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Turn any note into ruled pages in your own handwriting', styles: {} }], children: [] },
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
      { id: '4', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Mathematically: dx . dp >= h/2, where h is the reduced Planck constant.', styles: {} }], children: [] },
      { id: '5', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Wave-Particle Duality', styles: {} }], children: [] },
      { id: '6', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Light and matter exhibit properties of both waves and particles. The double-slit experiment demonstrates this: electrons create an interference pattern (wave behaviour) but are detected as individual particles.', styles: {} }], children: [] },
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
      { id: '5', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Overfitting & Regularisation', styles: {} }], children: [] },
      { id: '6', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Overfitting occurs when a model learns training data too well, failing to generalise. Techniques to prevent it: L1/L2 regularisation, dropout, early stopping, cross-validation.', styles: {} }], children: [] },
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
      { id: '3', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'YouTube lecture to structured notes converter', styles: {} }], children: [] },
      { id: '4', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Collaborative study rooms with shared notes', styles: {} }], children: [] },
      { id: '5', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Spaced repetition reminders for flashcard review', styles: {} }], children: [] },
    ]),
    tags: JSON.stringify(['ideas', 'product']),
    pinned: false,
  },
];

export interface EnsureDemoResult {
  created: boolean;
  passwordReset: boolean;
  notesAdded: number;
  email: string;
  password: string;
}

/**
 * Make the demo account usable, whatever state it is currently in.
 *
 * Deliberately self-healing rather than "create once and skip": a half-finished
 * earlier seed, a wiped free-tier database, or a row created with a different
 * password would otherwise leave the account permanently un-signinable while the
 * endpoint cheerfully reported "already seeded". Every call ends with the
 * password matching DEMO_PASSWORD, a Pro plan attached, and sample notes present.
 */
export async function ensureDemoAccount(): Promise<EnsureDemoResult> {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);

  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true, password: true },
  });

  let userId: string;
  let created = false;
  let passwordReset = false;

  if (existing) {
    userId = existing.id;
    // Only rewrite the hash when the documented password does not actually work.
    const valid = existing.password ? await bcrypt.compare(DEMO_PASSWORD, existing.password) : false;
    if (!valid) {
      await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
      passwordReset = true;
    }
  } else {
    const user = await prisma.user.create({
      data: { email: DEMO_EMAIL, password: hashed, name: 'Test User' },
    });
    userId = user.id;
    created = true;
  }

  // Pro plan so the AI features are not rate-limited while testing.
  await prisma.userPlan.upsert({
    where: { userId },
    update: { plan: 'pro', monthlyLimit: 10000 },
    create: { userId, plan: 'pro', monthlyLimit: 10000 },
  });

  // Only populate content the first time, so a tester's own edits are not
  // overwritten every time they press the button.
  let notesAdded = 0;
  const noteCount = await prisma.note.count({ where: { userId } });
  if (noteCount === 0) {
    const [studyCol, ideasCol] = await Promise.all([
      prisma.collection.create({ data: { userId, name: 'Study Notes', color: '#3B82F6' } }),
      prisma.collection.create({ data: { userId, name: 'Ideas', color: '#F59E0B' } }),
    ]);
    await Promise.all(
      SAMPLE_NOTES.map((n, i) =>
        prisma.note.create({
          data: {
            userId,
            title: n.title,
            content: n.content,
            tags: n.tags,
            color: n.color,
            pinned: n.pinned,
            collectionId: i === 1 || i === 2 ? studyCol.id : i === 3 ? ideasCol.id : null,
          },
        })
      )
    );
    notesAdded = SAMPLE_NOTES.length;
  }

  return { created, passwordReset, notesAdded, email: DEMO_EMAIL, password: DEMO_PASSWORD };
}
