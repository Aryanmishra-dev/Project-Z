import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Input } from '../Input';

describe('Input', () => {
  it('renders with default attributes', () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('renders with label', () => {
    render(<Input label="Email" id="email-input" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows required indicator when required', () => {
    render(<Input label="Email" id="email" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Input label="Email" id="email" error="Email is required" />);
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('border-error-500');
  });

  it('shows hint text', () => {
    render(<Input label="Password" id="password" hint="Must be at least 8 characters" />);
    expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
  });

  it('handles value changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'hello');
    expect(handleChange).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Input className="custom-class" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-class');
  });

  it('renders with different types', () => {
    const { rerender } = render(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');

    rerender(<Input type="password" />);
    expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password');
  });

  it('has proper aria attributes when error is present', () => {
    render(<Input id="test-input" label="Test" error="Error message" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<Input ref={ref} />);
    expect(ref).toHaveBeenCalled();
  });

  it('shows error over hint when both are present', () => {
    render(<Input error="Error message" hint="Hint text" />);
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument();
  });
});
