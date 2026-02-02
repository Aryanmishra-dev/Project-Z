import * as RadioGroup from '@radix-ui/react-radio-group';
import { Check, X } from 'lucide-react';

import { Badge } from '@/components/ui';
import type { Question } from '@/types';
import { cn } from '@/utils/cn';
import { DIFFICULTY_CONFIG } from '@/utils/constants';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedOption?: number;
  onSelect: (optionIndex: number) => void;
  showAnswer?: boolean;
  disabled?: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedOption,
  onSelect,
  showAnswer = false,
  disabled = false,
}: QuestionCardProps) {
  const difficultyConfig = DIFFICULTY_CONFIG[question.difficulty];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">
          Question {questionNumber} of {totalQuestions}
        </span>
        <Badge
          variant={
            question.difficulty === 'easy'
              ? 'success'
              : question.difficulty === 'medium'
                ? 'warning'
                : 'error'
          }
        >
          {difficultyConfig.label}
        </Badge>
      </div>

      {/* Question text */}
      <h2 className="text-xl font-medium text-gray-900 leading-relaxed">{question.questionText}</h2>

      {/* Options */}
      <RadioGroup.Root
        value={selectedOption?.toString()}
        onValueChange={(value) => onSelect(Number(value))}
        disabled={disabled || showAnswer}
        className="space-y-3"
      >
        {question.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isCorrect = index === question.correctOptionIndex;
          const showCorrectIndicator = showAnswer && isCorrect;
          const showIncorrectIndicator = showAnswer && isSelected && !isCorrect;

          return (
            <RadioGroup.Item
              key={index}
              value={index.toString()}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                !showAnswer && !disabled && 'hover:border-primary-300 hover:bg-primary-50',
                isSelected && !showAnswer && 'border-primary-500 bg-primary-50',
                showCorrectIndicator && 'border-success-500 bg-success-50',
                showIncorrectIndicator && 'border-error-500 bg-error-50',
                !isSelected &&
                  !showCorrectIndicator &&
                  !showIncorrectIndicator &&
                  'border-gray-200',
                disabled && !showAnswer && 'cursor-not-allowed opacity-60'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium',
                  isSelected && !showAnswer && 'border-primary-500 bg-primary-500 text-white',
                  showCorrectIndicator && 'border-success-500 bg-success-500 text-white',
                  showIncorrectIndicator && 'border-error-500 bg-error-500 text-white',
                  !isSelected &&
                    !showCorrectIndicator &&
                    !showIncorrectIndicator &&
                    'border-gray-300'
                )}
              >
                {showCorrectIndicator ? (
                  <Check className="h-4 w-4" />
                ) : showIncorrectIndicator ? (
                  <X className="h-4 w-4" />
                ) : (
                  String.fromCharCode(65 + index) // A, B, C, D
                )}
              </div>
              <span
                className={cn(
                  'flex-1',
                  showCorrectIndicator && 'text-success-700 font-medium',
                  showIncorrectIndicator && 'text-error-700'
                )}
              >
                {option.text}
              </span>
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>

      {/* Explanation (shown after answering) */}
      {showAnswer && question.explanation && (
        <div className="rounded-lg bg-info-50 border border-info-200 p-4">
          <h4 className="font-medium text-info-700">Explanation</h4>
          <p className="mt-1 text-sm text-info-600">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
