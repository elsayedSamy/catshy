import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Debounced value hook — delays updating the value until
 * the user stops changing it for `delay` ms.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Debounced callback — fires the callback at most once every `delay` ms.
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay = 300
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debouncedFn = useCallback((...args: any[]) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
  }, [delay]) as unknown as T;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return debouncedFn;
}
