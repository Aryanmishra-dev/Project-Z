import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Badge data-testid="badge">Default</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('bg-gray-100');
    expect(screen.getByTestId('badge')).toHaveClass('text-gray-700');
  });

  it('applies success variant styles', () => {
    render(<Badge variant="success" data-testid="badge">Success</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('bg-success-100');
    expect(screen.getByTestId('badge')).toHaveClass('text-success-700');
  });

  it('applies warning variant styles', () => {
    render(<Badge variant="warning" data-testid="badge">Warning</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('bg-warning-100');
    expect(screen.getByTestId('badge')).toHaveClass('text-warning-700');
  });

  it('applies error variant styles', () => {
    render(<Badge variant="error" data-testid="badge">Error</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('bg-error-100');
    expect(screen.getByTestId('badge')).toHaveClass('text-error-700');
  });

  it('applies info variant styles', () => {
    render(<Badge variant="info" data-testid="badge">Info</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('bg-info-100');
    expect(screen.getByTestId('badge')).toHaveClass('text-info-700');
  });

  it('applies primary variant styles', () => {
    render(<Badge variant="primary" data-testid="badge">Primary</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('bg-primary-100');
    expect(screen.getByTestId('badge')).toHaveClass('text-primary-700');
  });

  it('applies outline variant styles', () => {
    render(<Badge variant="outline" data-testid="badge">Outline</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('border');
    expect(screen.getByTestId('badge')).toHaveClass('border-gray-200');
  });

  it('accepts custom className', () => {
    render(<Badge className="custom-badge" data-testid="badge">Custom</Badge>);
    expect(screen.getByTestId('badge')).toHaveClass('custom-badge');
  });

  it('renders with base styles', () => {
    render(<Badge data-testid="badge">Base</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveClass('inline-flex');
    expect(badge).toHaveClass('items-center');
    expect(badge).toHaveClass('rounded-full');
    expect(badge).toHaveClass('text-xs');
    expect(badge).toHaveClass('font-medium');
  });
});
