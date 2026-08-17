import { Suspense } from 'react';
import HandwritingStudio from '@/components/handwriting/HandwritingStudio';

export const metadata = {
  title: 'Handwriting — DashNotes',
  description: 'Type anything and get it back as ruled pages in your own handwriting.',
};

export default async function HandwritingPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const { note } = await searchParams;

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-32 text-sm text-gray-400">
              Loading your handwriting…
            </div>
          }
        >
          <HandwritingStudio noteId={note} />
        </Suspense>
      </div>
    </main>
  );
}
