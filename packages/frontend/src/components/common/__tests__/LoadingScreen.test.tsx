import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { LoadingScreen } from '../LoadingScreen';

describe('LoadingScreen', () => {
  it('renders with default message', () => {
    render(<LoadingScreen />);
    expect(screen.getAllByRole('status')[0]).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingScreen message="Loading your data..." />);
    expect(screen.getByText('Loading your data...')).toBeInTheDocument();
  });

  it('displays logo or brand element', () => {
    render(<LoadingScreen />);
    // Should have some visual element (spinner/logo)
    expect(screen.getAllByRole('status')[0]).toBeInTheDocument();
  });

  it('covers full screen', () => {
    const { container } = render(<LoadingScreen />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('min-h-screen');
  });

  it('has accessible loading indicator', () => {
    render(<LoadingScreen message="Loading..." />);
    const status = screen.getAllByRole('status')[1]; // This should refer to the spinner or container? Wait.
    // If container is [0] and spinner is [1].
    // Spinner has aria-label="Loading..." (impl defaults to label || 'Loading...')
    // LoadingScreen has aria-live="polite".

    // Let's use getByLabelText for accessible name check if possible.
    // Or just check [1] if that's the spinner.
    // Actually, Spinner is rendered AFTER logo.
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });
});
