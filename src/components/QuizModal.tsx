'use client';

import { useState, useEffect } from 'react';
import { QuizQuestion } from '@/types';
import { X, CheckCircle, XCircle, ChevronRight, Trophy } from 'lucide-react';

interface QuizModalProps {
  questions: QuizQuestion[];
  onClose: () => void;
}

export default function QuizModal({ questions, onClose }: QuizModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (questions.length === 0) return null;

  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelectedOption(index);
    setAnswered(true);
    if (index === question.correct) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (isLast) {
      setShowResult(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setAnswered(false);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setShowResult(false);
    setAnswered(false);
  };

  if (showResult) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-center p-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mx-auto mb-5">
            <Trophy size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Quiz Complete!</h2>
          <p className="text-5xl font-extrabold text-violet-600 my-4">{score}/{questions.length}</p>
          <p className="text-gray-500 mb-2">
            {pct >= 80
              ? 'Excellent work!'
              : pct >= 60
              ? 'Good effort!'
              : 'Keep studying!'}
          </p>
          <p className="text-sm text-gray-400 mb-8">{pct}% correct</p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRestart}
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Quiz</h2>
            <p className="text-sm text-gray-400">
              Question {currentIndex + 1} of {questions.length} · Score: {score}/{currentIndex + (answered ? 1 : 0)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-violet-500 transition-all duration-300"
            style={{ width: `${((currentIndex + (answered ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Question */}
          <p className="text-xl font-semibold text-gray-900 mb-6 leading-relaxed">
            {question.question}
          </p>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {question.options.map((option, i) => {
              const isSelected = selectedOption === i;
              const isCorrect = i === question.correct;
              let optionClass = 'border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50';

              if (answered) {
                if (isCorrect) {
                  optionClass = 'border-green-500 bg-green-50 text-green-800';
                } else if (isSelected && !isCorrect) {
                  optionClass = 'border-red-400 bg-red-50 text-red-800';
                } else {
                  optionClass = 'border-gray-200 bg-gray-50 text-gray-500';
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={answered}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-3 ${optionClass} ${
                    answered ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {answered && isCorrect && <CheckCircle size={18} className="text-green-500 flex-shrink-0" />}
                  {answered && isSelected && !isCorrect && <XCircle size={18} className="text-red-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {answered && question.explanation && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6">
              <p className="text-xs font-semibold text-blue-600 mb-1">Explanation</p>
              <p className="text-sm text-blue-800 leading-relaxed">{question.explanation}</p>
            </div>
          )}

          {/* Next button */}
          {answered && (
            <div className="flex justify-end">
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
              >
                {isLast ? 'See Results' : 'Next Question'}
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
