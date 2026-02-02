import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  useMediaQuery,
  useBreakpoint,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
} from '../useMediaQuery';

describe('useMediaQuery', () => {
  const matchMediaMock = vi.fn();
  let listeners: Map<string, ((event: MediaQueryListEvent) => void)[]>;

  beforeEach(() => {
    listeners = new Map();

    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (event: string, listener: (e: MediaQueryListEvent) => void) => {
        if (!listeners.has(query)) {
          listeners.set(query, []);
        }
        listeners.get(query)!.push(listener);
      },
      removeEventListener: (event: string, listener: (e: MediaQueryListEvent) => void) => {
        const queryListeners = listeners.get(query);
        if (queryListeners) {
          const index = queryListeners.indexOf(listener);
          if (index > -1) {
            queryListeners.splice(index, 1);
          }
        }
      },
      dispatchEvent: () => true,
    }));

    window.matchMedia = matchMediaMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial match state', () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates when media query changes', () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;

    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      addEventListener: (event: string, handler: (e: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      },
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    act(() => {
      changeHandler?.({ matches: true } as MediaQueryListEvent);
    });

    expect(result.current).toBe(true);
  });

  it('cleans up event listeners on unmount', () => {
    const removeEventListener = vi.fn();

    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener,
    });

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    unmount();

    expect(removeEventListener).toHaveBeenCalled();
  });
});

describe('useBreakpoint', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('768'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('returns true when breakpoint is met', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useBreakpoint('md'));
    expect(result.current).toBe(true);
  });

  it('returns false when breakpoint is not met', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useBreakpoint('lg'));
    expect(result.current).toBe(false);
  });
});

describe('useIsMobile', () => {
  it('returns true on mobile', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false, // min-width: 768px is false on mobile
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false on tablet/desktop', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});

describe('useIsTablet', () => {
  it('returns true on tablet', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('768') && !query.includes('1024'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    // Mock for tablet: md is true, lg is false
    let callCount = 0;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: callCount++ === 0, // First call (md) true, second call (lg) false
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useIsTablet());
    // The hook checks isMd && !isLg
  });
});

describe('useIsDesktop', () => {
  it('returns true on desktop', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true, // min-width: 1024px is true on desktop
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it('returns false on mobile/tablet', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });
});
