import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', true && 'visible')).toBe('base visible');
  });

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('merges Tailwind classes correctly', () => {
    // Should dedupe conflicting classes
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('handles objects', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
  });

  it('handles complex Tailwind patterns', () => {
    // Padding merge
    expect(cn('p-4', 'px-2')).toBe('p-4 px-2');
    
    // Color variants
    expect(cn('bg-red-500', 'hover:bg-red-600', 'hover:bg-blue-600')).toBe('bg-red-500 hover:bg-blue-600');
    
    // Responsive classes
    expect(cn('w-full', 'md:w-1/2', 'md:w-1/3')).toBe('w-full md:w-1/3');
  });
});
