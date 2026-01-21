import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_PREFIX = 'outliner-session';

export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = `${STORAGE_PREFIX}:${key}`;
  const prevKeyRef = useRef(storageKey);
  // Store initialValue in a ref to avoid it causing re-renders
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(storageKey);
      if (item) {
        return JSON.parse(item);
      }
    } catch (e) {
      console.warn(`Failed to load ${key} from localStorage:`, e);
    }
    return initialValue;
  });

  // Re-read from storage when key changes (but NOT when initialValue changes)
  useEffect(() => {
    if (prevKeyRef.current !== storageKey) {
      prevKeyRef.current = storageKey;
      try {
        const item = localStorage.getItem(storageKey);
        if (item) {
          setStoredValue(JSON.parse(item));
        } else {
          setStoredValue(initialValueRef.current);
        }
      } catch (e) {
        console.warn(`Failed to load ${key} from localStorage:`, e);
        setStoredValue(initialValueRef.current);
      }
    }
  }, [storageKey, key]);

  // Persist whenever value changes (debounced to avoid locking the UI for large payloads)
  const persistTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(storedValue));
      } catch (e) {
        console.warn(`Failed to save ${key} to localStorage:`, e);
      }
    }, 200);

    return () => {
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [storageKey, storedValue, key]);

  // Stable setter reference
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(value);
  }, []);

  return [storedValue, setValue];
}

// Clear all session data
export function clearSessionStorage() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}
