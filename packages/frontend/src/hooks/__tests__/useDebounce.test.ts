import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useDebounce, useDebouncedValue } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, { delay: 300 }));
    const [debouncedFn] = result.current;

    debouncedFn();
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, { delay: 300 }));
    const [debouncedFn] = result.current;

    debouncedFn();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    debouncedFn(); // Reset timer

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to callback', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, { delay: 300 }));
    const [debouncedFn] = result.current;

    debouncedFn('arg1', 'arg2');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('can be cancelled', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, { delay: 300 }));
    const [debouncedFn, cancel] = result.current;

    debouncedFn();
    cancel();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('executes immediately when immediate is true', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, { delay: 300, immediate: true }));
    const [debouncedFn] = result.current;

    debouncedFn();
    expect(callback).toHaveBeenCalledTimes(1);

    // Subsequent calls should be debounced
    debouncedFn();
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // After delay, should be able to call immediately again
    debouncedFn();
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'initial' },
    });

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('resets timer on value change', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'initial' },
    });

    rerender({ value: 'first' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'second' });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('second');
  });
});
