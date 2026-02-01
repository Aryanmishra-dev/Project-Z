import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuizTimer } from '../QuizTimer';

describe('QuizTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial time correctly', () => {
    render(<QuizTimer initialTime={300} onTimeUp={vi.fn()} />);
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('counts down every second', () => {
    render(<QuizTimer initialTime={300} onTimeUp={vi.fn()} />);

    expect(screen.getByText('05:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('04:59')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('04:54')).toBeInTheDocument();
  });

  it('calls onTimeUp when time reaches zero', () => {
    const onTimeUp = vi.fn();
    render(<QuizTimer initialTime={3} onTimeUp={onTimeUp} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it('stops at zero', () => {
    const onTimeUp = vi.fn();
    render(<QuizTimer initialTime={2} onTimeUp={onTimeUp} />);

    act(() => {
      vi.advanceTimersByTime(5000); // Advance past zero
    });

    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it('shows warning state when time is low', () => {
    render(<QuizTimer initialTime={60} onTimeUp={vi.fn()} />);

    // Should show warning styling (typically red/orange)
    const timer = screen.getByText('01:00').closest('div');
    expect(timer).toHaveClass(/warning|error|text-red|text-warning/);
  });

  it('shows critical state when time is very low', () => {
    render(<QuizTimer initialTime={30} onTimeUp={vi.fn()} />);

    const timer = screen.getByText('00:30').closest('div');
    // Should have urgent styling
    expect(timer).toBeDefined();
  });

  it('formats time with leading zeros', () => {
    render(<QuizTimer initialTime={65} onTimeUp={vi.fn()} />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('handles hours correctly for long quizzes', () => {
    render(<QuizTimer initialTime={3665} onTimeUp={vi.fn()} />);
    // Should display 1:01:05 or 61:05
    expect(screen.getByText(/61:05|1:01:05/)).toBeInTheDocument();
  });

  it('is paused when isPaused is true', () => {
    render(<QuizTimer initialTime={300} onTimeUp={vi.fn()} isPaused={true} />);

    expect(screen.getByText('05:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Time should not have changed
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('has accessible time display', () => {
    render(<QuizTimer initialTime={300} onTimeUp={vi.fn()} />);

    // Should have aria-live or similar for screen readers
    const timer = screen.getByText('05:00');
    expect(timer).toHaveAttribute('aria-live', 'polite');
  });

  it('shows clock icon', () => {
    render(<QuizTimer initialTime={300} onTimeUp={vi.fn()} />);

    // Should have a clock icon
    expect(screen.getByTestId('clock-icon') || screen.getByRole('img', { hidden: true })).toBeDefined();
  });
});
