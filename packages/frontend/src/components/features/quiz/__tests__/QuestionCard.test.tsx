import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionCard } from '../QuestionCard';

const mockQuestion = {
  id: '1',
  questionText: 'What is the capital of France?',
  options: [
    { id: 'a', text: 'London' },
    { id: 'b', text: 'Berlin' },
    { id: 'c', text: 'Paris' },
    { id: 'd', text: 'Madrid' },
  ],
  difficulty: 'medium' as const,
  correctAnswer: 'c',
  explanation: 'Paris is the capital and largest city of France.',
};

describe('QuestionCard', () => {
  it('renders question text', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('London')).toBeInTheDocument();
    expect(screen.getByText('Berlin')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('Madrid')).toBeInTheDocument();
  });

  it('displays question number', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={3}
        totalQuestions={10}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText(/3.*of.*10|question 3/i)).toBeInTheDocument();
  });

  it('displays difficulty badge', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it('calls onAnswer when option is selected', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();

    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={onAnswer}
      />
    );

    await user.click(screen.getByText('Paris'));
    expect(onAnswer).toHaveBeenCalledWith('c');
  });

  it('shows selected option visually', async () => {
    const user = userEvent.setup();

    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        selectedAnswer="c"
        onAnswer={vi.fn()}
      />
    );

    // Paris option should be visually selected
    const parisOption = screen.getByText('Paris').closest('button, label, div');
    expect(parisOption).toHaveClass(/selected|checked|bg-primary|ring/);
  });

  it('shows correct/incorrect feedback in review mode', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        selectedAnswer="b"
        showResult={true}
        onAnswer={vi.fn()}
      />
    );

    // Should highlight Paris as correct
    const correctOption = screen.getByText('Paris').closest('button, label, div');
    expect(correctOption).toHaveClass(/correct|success|green/);

    // Should highlight Berlin as wrong (selected but incorrect)
    const wrongOption = screen.getByText('Berlin').closest('button, label, div');
    expect(wrongOption).toHaveClass(/incorrect|error|red/);
  });

  it('shows explanation in review mode', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        selectedAnswer="c"
        showResult={true}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText(/Paris is the capital/)).toBeInTheDocument();
  });

  it('disables options in review mode', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();

    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        selectedAnswer="c"
        showResult={true}
        onAnswer={onAnswer}
      />
    );

    await user.click(screen.getByText('London'));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('shows options as radio buttons for accessibility', () => {
    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={vi.fn()}
      />
    );

    const radioButtons = screen.getAllByRole('radio');
    expect(radioButtons).toHaveLength(4);
  });

  it('is keyboard navigable', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();

    render(
      <QuestionCard
        question={mockQuestion}
        questionNumber={1}
        totalQuestions={10}
        onAnswer={onAnswer}
      />
    );

    // Tab to first option and select with Enter
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onAnswer).toHaveBeenCalled();
  });
});
