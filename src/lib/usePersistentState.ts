import { useEffect, useState } from 'react';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** useState that survives reloads via localStorage (silently falls back to memory). */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      if (s != null) {
        const parsed = JSON.parse(s);
        // merge so newly added settings get their defaults
        return (isObj(initial) && isObj(parsed) ? { ...initial, ...parsed } : parsed) as T;
      }
    } catch {
      /* ignore */
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
