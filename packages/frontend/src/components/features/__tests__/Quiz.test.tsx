/**
 * Quiz Component Unit Tests
 * Tests for quiz taking, timer, and submission functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock services
vi.mock('../../services/quiz.service', () => ({
  quizService: {
    getSession: vi.fn(),
    submitAnswer: vi.fn(),
    submitAllAnswers: vi.fn(),
    completeSession: vi.fn(),
    abandonSession: vi.fn(),
  },
}));

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: true,
    subscribe: vi.fn(),
    emit: vi.fn(),
    error: null,
  })),
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Quiz Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe('QuizQuestion Component', () => {
    const mockQuestion = {
      id: 'q-1',
      questionText: 'What is the capital of France?',
      optionA: 'London',
      optionB: 'Paris',
      optionC: 'Berlin',
      optionD: 'Madrid',
      difficulty: 'easy' as const,
    };

    it('should render question text', async () => {
      // Import and render component
      const { QuizQuestion } = await import('../../components/features/quiz/QuizQuestion');
      
      render(
        <TestWrapper>
          <QuizQuestion 
            question={mockQuestion} 
            selectedOption={null}
            onSelectOption={vi.fn()}
            showAnswer={false}
          />
        </TestWrapper>
      );

      expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
    });

    it('should render all answer options', async () => {
      const { QuizQuestion } = await import('../../components/features/quiz/QuizQuestion');
      
      render(
        <TestWrapper>
          <QuizQuestion 
            question={mockQuestion} 
            selectedOption={null}
            onSelectOption={vi.fn()}
            showAnswer={false}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/London/)).toBeInTheDocument();
      expect(screen.getByText(/Paris/)).toBeInTheDocument();
      expect(screen.getByText(/Berlin/)).toBeInTheDocument();
      expect(screen.getByText(/Madrid/)).toBeInTheDocument();
    });

    it('should call onSelectOption when an option is clicked', async () => {
      const onSelectOption = vi.fn();
      const { QuizQuestion } = await import('../../components/features/quiz/QuizQuestion');
      
      render(
        <TestWrapper>
          <QuizQuestion 
            question={mockQuestion} 
            selectedOption={null}
            onSelectOption={onSelectOption}
            showAnswer={false}
          />
        </TestWrapper>
      );

      const option = screen.getByText(/Paris/);
      await userEvent.click(option);

      expect(onSelectOption).toHaveBeenCalledWith('B');
    });

    it('should highlight selected option', async () => {
      const { QuizQuestion } = await import('../../components/features/quiz/QuizQuestion');
      
      render(
        <TestWrapper>
          <QuizQuestion 
            question={mockQuestion} 
            selectedOption="B"
            onSelectOption={vi.fn()}
            showAnswer={false}
          />
        </TestWrapper>
      );

      const selectedOption = screen.getByText(/Paris/).closest('button');
      expect(selectedOption).toHaveClass('selected');
    });

    it('should show correct answer when showAnswer is true', async () => {
      const questionWithAnswer = {
        ...mockQuestion,
        correctOption: 'B',
      };

      const { QuizQuestion } = await import('../../components/features/quiz/QuizQuestion');
      
      render(
        <TestWrapper>
          <QuizQuestion 
            question={questionWithAnswer} 
            selectedOption="A"
            onSelectOption={vi.fn()}
            showAnswer={true}
          />
        </TestWrapper>
      );

      // Correct answer should be highlighted
      const correctOption = screen.getByText(/Paris/).closest('button');
      expect(correctOption).toHaveClass('correct');

      // Wrong selected answer should be highlighted differently
      const wrongOption = screen.getByText(/London/).closest('button');
      expect(wrongOption).toHaveClass('incorrect');
    });

    it('should disable options when showAnswer is true', async () => {
      const { QuizQuestion } = await import('../../components/features/quiz/QuizQuestion');
      
      render(
        <TestWrapper>
          <QuizQuestion 
            question={mockQuestion} 
            selectedOption="B"
            onSelectOption={vi.fn()}
            showAnswer={true}
          />
        </TestWrapper>
      );

      const options = screen.getAllByRole('button');
      options.forEach(option => {
        expect(option).toBeDisabled();
      });
    });

    it('should support keyboard navigation', async () => {
      const onSelectOption = vi.fn();
      const { QuizQuestion } = await import('../../components/features/quiz/QuizQuestion');
      
      render(
        <TestWrapper>
          <QuizQuestion 
            question={mockQuestion} 
            selectedOption={null}
            onSelectOption={onSelectOption}
            showAnswer={false}
          />
        </TestWrapper>
      );

      // Press '1' for option A
      fireEvent.keyDown(document.body, { key: '1' });
      expect(onSelectOption).toHaveBeenCalledWith('A');

      // Press '2' for option B
      fireEvent.keyDown(document.body, { key: '2' });
      expect(onSelectOption).toHaveBeenCalledWith('B');
    });
  });

  describe('QuizTimer Component', () => {
    it('should display remaining time', async () => {
      const { QuizTimer } = await import('../../components/features/quiz/QuizTimer');
      
      render(
        <TestWrapper>
          <QuizTimer 
            totalSeconds={3600} 
            remainingSeconds={1800}
            onTimeout={vi.fn()}
          />
        </TestWrapper>
      );

      // Should show 30:00
      expect(screen.getByText(/30:00/)).toBeInTheDocument();
    });

    it('should count down every second', async () => {
      const { QuizTimer } = await import('../../components/features/quiz/QuizTimer');
      
      const { rerender } = render(
        <TestWrapper>
          <QuizTimer 
            totalSeconds={3600} 
            remainingSeconds={60}
            onTimeout={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/1:00/)).toBeInTheDocument();

      // Advance time
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      rerender(
        <TestWrapper>
          <QuizTimer 
            totalSeconds={3600} 
            remainingSeconds={59}
            onTimeout={vi.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/0:59/)).toBeInTheDocument();
    });

    it('should call onTimeout when time expires', async () => {
      const onTimeout = vi.fn();
      const { QuizTimer } = await import('../../components/features/quiz/QuizTimer');
      
      const { rerender } = render(
        <TestWrapper>
          <QuizTimer 
            totalSeconds={3600} 
            remainingSeconds={1}
            onTimeout={onTimeout}
          />
        </TestWrapper>
      );

      // Advance past timeout
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      rerender(
        <TestWrapper>
          <QuizTimer 
            totalSeconds={3600} 
            remainingSeconds={0}
            onTimeout={onTimeout}
          />
        </TestWrapper>
      );

      expect(onTimeout).toHaveBeenCalled();
    });

    it('should show warning color when time is low', async () => {
      const { QuizTimer } = await import('../../components/features/quiz/QuizTimer');
      
      render(
        <TestWrapper>
          <QuizTimer 
            totalSeconds={3600} 
            remainingSeconds={60} // 1 minute left
            onTimeout={vi.fn()}
            warningThreshold={120}
          />
        </TestWrapper>
      );

      const timer = screen.getByRole('timer');
      expect(timer).toHaveClass('warning');
    });

    it('should show critical color when time is very low', async () => {
      const { QuizTimer } = await import('../../components/features/quiz/QuizTimer');
      
      render(
        <TestWrapper>
          <QuizTimer 
            totalSeconds={3600} 
            remainingSeconds={30} // 30 seconds left
            onTimeout={vi.fn()}
            criticalThreshold={60}
          />
        </TestWrapper>
      );

      const timer = screen.getByRole('timer');
      expect(timer).toHaveClass('critical');
    });
  });

  describe('QuizProgress Component', () => {
    it('should show current question number', async () => {
      const { QuizProgress } = await import('../../components/features/quiz/QuizProgress');
      
      render(
        <TestWrapper>
          <QuizProgress 
            currentQuestion={5}
            totalQuestions={10}
            answeredQuestions={4}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/5.*of.*10/i)).toBeInTheDocument();
    });

    it('should show progress percentage', async () => {
      const { QuizProgress } = await import('../../components/features/quiz/QuizProgress');
      
      render(
        <TestWrapper>
          <QuizProgress 
            currentQuestion={5}
            totalQuestions={10}
            answeredQuestions={5}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('should indicate answered questions', async () => {
      const { QuizProgress } = await import('../../components/features/quiz/QuizProgress');
      
      render(
        <TestWrapper>
          <QuizProgress 
            currentQuestion={5}
            totalQuestions={10}
            answeredQuestions={4}
          />
        </TestWrapper>
      );

      // Should show 4 answered indicators
      const answeredIndicators = screen.getAllByTestId('answered-indicator');
      expect(answeredIndicators).toHaveLength(4);
    });
  });

  describe('QuizNavigation Component', () => {
    it('should navigate to previous question', async () => {
      const onPrevious = vi.fn();
      const { QuizNavigation } = await import('../../components/features/quiz/QuizNavigation');
      
      render(
        <TestWrapper>
          <QuizNavigation 
            currentQuestion={5}
            totalQuestions={10}
            onPrevious={onPrevious}
            onNext={vi.fn()}
            onSubmit={vi.fn()}
            canGoBack={true}
          />
        </TestWrapper>
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      await userEvent.click(prevButton);

      expect(onPrevious).toHaveBeenCalled();
    });

    it('should disable previous button on first question', async () => {
      const { QuizNavigation } = await import('../../components/features/quiz/QuizNavigation');
      
      render(
        <TestWrapper>
          <QuizNavigation 
            currentQuestion={1}
            totalQuestions={10}
            onPrevious={vi.fn()}
            onNext={vi.fn()}
            onSubmit={vi.fn()}
            canGoBack={false}
          />
        </TestWrapper>
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('should show submit button on last question', async () => {
      const { QuizNavigation } = await import('../../components/features/quiz/QuizNavigation');
      
      render(
        <TestWrapper>
          <QuizNavigation 
            currentQuestion={10}
            totalQuestions={10}
            onPrevious={vi.fn()}
            onNext={vi.fn()}
            onSubmit={vi.fn()}
            canGoBack={true}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    it('should confirm before submit if not all questions answered', async () => {
      const onSubmit = vi.fn();
      const { QuizNavigation } = await import('../../components/features/quiz/QuizNavigation');
      
      render(
        <TestWrapper>
          <QuizNavigation 
            currentQuestion={10}
            totalQuestions={10}
            onPrevious={vi.fn()}
            onNext={vi.fn()}
            onSubmit={onSubmit}
            canGoBack={true}
            unansweredCount={3}
          />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await userEvent.click(submitButton);

      // Should show confirmation dialog
      expect(screen.getByText(/3 unanswered questions/i)).toBeInTheDocument();
    });
  });

  describe('Quiz Submission', () => {
    it('should submit all answers on completion', async () => {
      const { quizService } = await import('../../services/quiz.service');
      
      (quizService.submitAllAnswers as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        score: 80,
        correctAnswers: 8,
        totalQuestions: 10,
      });

      // Test submission flow
      await quizService.submitAllAnswers('session-123', [
        { questionId: 'q1', selectedOption: 'A' },
        { questionId: 'q2', selectedOption: 'B' },
      ]);

      expect(quizService.submitAllAnswers).toHaveBeenCalled();
    });

    it('should handle submission error', async () => {
      const { quizService } = await import('../../services/quiz.service');
      
      (quizService.submitAllAnswers as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(
        quizService.submitAllAnswers('session-123', [])
      ).rejects.toThrow('Network error');
    });

    it('should handle partial answers submission', async () => {
      const { quizService } = await import('../../services/quiz.service');
      
      (quizService.submitAllAnswers as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        score: 30,
        correctAnswers: 3,
        totalQuestions: 10,
        answeredQuestions: 5,
      });

      const result = await quizService.submitAllAnswers('session-123', [
        { questionId: 'q1', selectedOption: 'A' },
        { questionId: 'q2', selectedOption: 'B' },
        { questionId: 'q3', selectedOption: 'C' },
        { questionId: 'q4', selectedOption: 'A' },
        { questionId: 'q5', selectedOption: 'B' },
      ]);

      expect(result.answeredQuestions).toBe(5);
    });
  });

  describe('Quiz Abandonment', () => {
    it('should confirm before abandoning quiz', async () => {
      const onAbandon = vi.fn();
      
      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValueOnce(true);

      onAbandon();

      expect(onAbandon).toHaveBeenCalled();
    });

    it('should save progress before abandoning', async () => {
      const { quizService } = await import('../../services/quiz.service');
      
      (quizService.abandonSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        status: 'abandoned',
      });

      await quizService.abandonSession('session-123');

      expect(quizService.abandonSession).toHaveBeenCalledWith('session-123');
    });
  });
});

describe('Quiz Results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('QuizResults Component', () => {
    const mockResults = {
      sessionId: 'session-123',
      score: 80,
      correctAnswers: 8,
      totalQuestions: 10,
      timeSpent: 1800,
      questions: [
        {
          id: 'q1',
          questionText: 'Question 1',
          selectedOption: 'A',
          correctOption: 'A',
          isCorrect: true,
        },
        {
          id: 'q2',
          questionText: 'Question 2',
          selectedOption: 'B',
          correctOption: 'A',
          isCorrect: false,
        },
      ],
    };

    it('should display score', async () => {
      const { QuizResults } = await import('../../components/features/quiz/QuizResults');
      
      render(
        <TestWrapper>
          <QuizResults results={mockResults} />
        </TestWrapper>
      );

      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });

    it('should display correct/total answers', async () => {
      const { QuizResults } = await import('../../components/features/quiz/QuizResults');
      
      render(
        <TestWrapper>
          <QuizResults results={mockResults} />
        </TestWrapper>
      );

      expect(screen.getByText(/8.*of.*10/i)).toBeInTheDocument();
    });

    it('should show confetti for high scores', async () => {
      const { QuizResults } = await import('../../components/features/quiz/QuizResults');
      
      render(
        <TestWrapper>
          <QuizResults results={{ ...mockResults, score: 90 }} />
        </TestWrapper>
      );

      // Confetti should be visible for scores >= 80
      expect(screen.getByTestId('confetti')).toBeInTheDocument();
    });

    it('should not show confetti for low scores', async () => {
      const { QuizResults } = await import('../../components/features/quiz/QuizResults');
      
      render(
        <TestWrapper>
          <QuizResults results={{ ...mockResults, score: 50 }} />
        </TestWrapper>
      );

      expect(screen.queryByTestId('confetti')).not.toBeInTheDocument();
    });

    it('should allow reviewing answers', async () => {
      const { QuizResults } = await import('../../components/features/quiz/QuizResults');
      
      render(
        <TestWrapper>
          <QuizResults results={mockResults} />
        </TestWrapper>
      );

      const reviewButton = screen.getByRole('button', { name: /review/i });
      await userEvent.click(reviewButton);

      // Should show answers review
      expect(screen.getByText('Question 1')).toBeInTheDocument();
    });

    it('should show explanation for each question', async () => {
      const resultsWithExplanations = {
        ...mockResults,
        questions: [
          {
            ...mockResults.questions[0],
            explanation: 'This is the explanation for question 1',
          },
        ],
      };

      const { QuizResults } = await import('../../components/features/quiz/QuizResults');
      
      render(
        <TestWrapper>
          <QuizResults results={resultsWithExplanations} />
        </TestWrapper>
      );

      const reviewButton = screen.getByRole('button', { name: /review/i });
      await userEvent.click(reviewButton);

      expect(screen.getByText(/explanation for question 1/i)).toBeInTheDocument();
    });
  });
});
