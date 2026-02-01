import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../Spinner';

describe('Spinner', () => {
  it('renders without label', () => {
    render(<Spinner data-testid="spinner" />);
    const spinner = screen.getByTestId('spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Spinner label="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('has accessible label for screen readers', () => {
    render(<Spinner label="Loading data" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Loading data');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<Spinner size="sm" data-testid="spinner" />);
    expect(screen.getByTestId('spinner').querySelector('svg')).toHaveClass('h-4', 'w-4');

    rerender(<Spinner size="md" data-testid="spinner" />);
    expect(screen.getByTestId('spinner').querySelector('svg')).toHaveClass('h-6', 'w-6');

    rerender(<Spinner size="lg" data-testid="spinner" />);
    expect(screen.getByTestId('spinner').querySelector('svg')).toHaveClass('h-8', 'w-8');
  });

  it('applies animation class', () => {
    render(<Spinner data-testid="spinner" />);
    expect(screen.getByTestId('spinner').querySelector('svg')).toHaveClass('animate-spin');
  });

  it('accepts custom className', () => {
    render(<Spinner className="custom-spinner" data-testid="spinner" />);
    expect(screen.getByTestId('spinner')).toHaveClass('custom-spinner');
  });
});
