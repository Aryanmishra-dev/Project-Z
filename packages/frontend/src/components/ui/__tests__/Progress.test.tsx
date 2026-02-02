import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Progress } from '../Progress';

describe('Progress', () => {
  it('renders with default value', () => {
    render(<Progress value={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets correct aria attributes', () => {
    render(<Progress value={50} max={100} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('displays label when provided', () => {
    render(<Progress value={50} label="Progress" />);
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('displays value when showValue is true', () => {
    render(<Progress value={75} showValue />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('calculates percentage correctly with custom max', () => {
    render(<Progress value={50} max={200} showValue />);
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('applies variant styles', () => {
    const { rerender, container } = render(<Progress value={50} variant="default" />);
    expect(container.querySelector('[class*="bg-primary-600"]')).toBeInTheDocument();

    rerender(<Progress value={50} variant="success" />);
    expect(container.querySelector('[class*="bg-success"]')).toBeInTheDocument();

    rerender(<Progress value={50} variant="warning" />);
    expect(container.querySelector('[class*="bg-warning"]')).toBeInTheDocument();

    rerender(<Progress value={50} variant="error" />);
    expect(container.querySelector('[class*="bg-error"]')).toBeInTheDocument();
  });

  it('clamps value between 0 and max', () => {
    const { rerender } = render(<Progress value={-10} max={100} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    rerender(<Progress value={150} max={100} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('accepts custom className', () => {
    render(<Progress value={50} className="custom-progress" />);
    expect(screen.getByRole('progressbar')).toHaveClass('custom-progress');
  });

  it('shows both label and value', () => {
    render(<Progress value={50} label="Loading" showValue />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});
