import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { QuizTimer } from '../QuizTimer';

describe('QuizTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial time correctly', () => {
    render(<QuizTimer seconds={300} onTick={vi.fn()} />);
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('calls onTick every second', () => {
    const onTick = vi.fn();
    render(<QuizTimer seconds={300} onTick={onTick} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onTick).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onTick).toHaveBeenCalledTimes(6);
  });

  it('stops ticking when paused', () => {
    const onTick = vi.fn();
    render(<QuizTimer seconds={300} onTick={onTick} isPaused={true} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onTick).not.toHaveBeenCalled();
  });

  it('stops ticking when time reaches zero', () => {
    const onTick = vi.fn();
    render(<QuizTimer seconds={0} onTick={onTick} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onTick).not.toHaveBeenCalled();
  });

  it('shows warning state when time is low', () => {
    render(<QuizTimer seconds={50} onTick={vi.fn()} warningThreshold={60} />);

    // Should show warning styling (typically red/orange)
    const timer = screen.getByRole('timer');
    expect(timer).toHaveClass(/warning|text-warning/);
  });

  it('shows critical state when time is very low', () => {
    render(<QuizTimer seconds={10} onTick={vi.fn()} />);

    const timer = screen.getByRole('timer');
    // Should have urgent styling
    expect(timer).toHaveClass(/error|text-error/);
  });

  it('formats time with leading zeros', () => {
    render(<QuizTimer seconds={65} onTick={vi.fn()} />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('handles hours correctly for long quizzes', () => {
    render(<QuizTimer seconds={3665} onTick={vi.fn()} />);
    expect(screen.getByText(/61:05|0?1:01:05/)).toBeInTheDocument();
  });

  it('has accessible time display', () => {
    render(<QuizTimer seconds={300} onTick={vi.fn()} />);

    const timer = screen.getByRole('timer');
    expect(timer).toHaveAttribute('aria-live', 'polite');
    expect(timer).toHaveAttribute('aria-label', expect.stringContaining('05:00'));
  });
});
