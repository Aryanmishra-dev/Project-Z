import { useCallback, useRef, useState } from 'react';

interface UseDebounceOptions {
  delay?: number;
  immediate?: boolean;
}

export function useDebounce<T extends (...args: Parameters<T>) => void>(
  callback: T,
  options: UseDebounceOptions = {}
): [(...args: Parameters<T>) => void, () => void] {
  const { delay = 300, immediate = false } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref on each render
  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      const callNow = immediate && !timeoutRef.current;

      cancel();

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (!immediate) {
          callbackRef.current(...args);
        }
      }, delay);

      if (callNow) {
        callbackRef.current(...args);
      }
    },
    [delay, immediate, cancel]
  );

  return [debouncedCallback, cancel];
}

export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  const [debouncedSetter] = useDebounce((newValue: T) => setDebouncedValue(newValue), { delay });

  // Update debounced value when input value changes
  debouncedSetter(value);

  return debouncedValue;
}
