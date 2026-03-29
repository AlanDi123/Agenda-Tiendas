import { useCallback, useLayoutEffect, useRef } from 'react';

// Tipado estricto reemplazando 'any' por 'unknown'
export function useDebounce<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);

  // La actualización de refs debe ir dentro de un efecto, NUNCA suelta en el componente
  useLayoutEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        if (fnRef.current) {
          fnRef.current(...args);
        }
      }, delay);
    },
    [delay]
  );
}
