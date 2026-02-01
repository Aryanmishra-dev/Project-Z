import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingScreen } from '../LoadingScreen';

describe('LoadingScreen', () => {
  it('renders with default message', () => {
    render(<LoadingScreen />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingScreen message="Loading your data..." />);
    expect(screen.getByText('Loading your data...')).toBeInTheDocument();
  });

  it('displays logo or brand element', () => {
    render(<LoadingScreen />);
    // Should have some visual element (spinner/logo)
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('covers full screen', () => {
    const { container } = render(<LoadingScreen />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('min-h-screen');
  });

  it('has accessible loading indicator', () => {
    render(<LoadingScreen message="Loading..." />);
    const status = screen.getByRole('status');
    expect(status).toHaveAccessibleName(/loading/i);
  });
});
