import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'outliner-session';

export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = `${STORAGE_PREFIX}:${key}`;

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

  // Persist whenever value changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(storedValue));
    } catch (e) {
      console.warn(`Failed to save ${key} to localStorage:`, e);
    }
  }, [storageKey, storedValue]);

  return [storedValue, setStoredValue];
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
