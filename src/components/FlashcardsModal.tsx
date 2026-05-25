'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flashcard } from '@/types';
import { X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface FlashcardsModalProps {
  flashcards: Flashcard[];
  onClose: () => void;
}

export default function FlashcardsModal({ flashcards, onClose }: FlashcardsModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const goNext = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % flashcards.length);
    }, 150);
  }, [flashcards.length]);

  const goPrev = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((i) => (i - 1 + flashcards.length) % flashcards.length);
    }, 150);
  }, [flashcards.length]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setIsFlipped((f) => !f); }
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  if (flashcards.length === 0) return null;

  const card = flashcards[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Flashcards</h2>
            <p className="text-sm text-gray-400">
              Card {currentIndex + 1} of {flashcards.length} · Click to flip
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-violet-500 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div className="p-8">
          <div
            className="relative cursor-pointer"
            onClick={() => setIsFlipped((f) => !f)}
            style={{ perspective: '1000px', height: '240px' }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.4s ease',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Front */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
                className="flex flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border-2 border-violet-100 p-8"
              >
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-4">Question</p>
                <p className="text-xl font-semibold text-gray-900 text-center leading-relaxed">
                  {card.front}
                </p>
              </div>

              {/* Back */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
                className="flex flex-col items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50 rounded-2xl border-2 border-cyan-100 p-8"
              >
                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-4">Answer</p>
                <p className="text-xl font-semibold text-gray-900 text-center leading-relaxed">
                  {card.back}
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={goPrev}
              disabled={flashcards.length <= 1}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={18} />
              Previous
            </button>

            <button
              onClick={() => setIsFlipped((f) => !f)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              <RotateCcw size={15} />
              Flip
            </button>

            <button
              onClick={goNext}
              disabled={flashcards.length <= 1}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Space / Enter to flip · Arrow keys to navigate · Esc to close
          </p>
        </div>
      </div>
    </div>
  );
}
