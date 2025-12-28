import { useState, useCallback, useRef } from 'react';

interface UseHistoryOptions<T> {
  maxHistory?: number;
}

export function useHistory<T>(initialState: T, options: UseHistoryOptions<T> = {}) {
  const { maxHistory = 50 } = options;
  
  const [state, setState] = useState<T>(initialState);
  const historyRef = useRef<T[]>([initialState]);
  const indexRef = useRef(0);
  const isUndoRedoRef = useRef(false);

  const set = useCallback((newState: T | ((prev: T) => T)) => {
    setState(prev => {
      const nextState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(prev)
        : newState;
      
      // Don't add to history if this is an undo/redo operation
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false;
        return nextState;
      }
      
      // Truncate any future history if we're not at the end
      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
      
      // Add new state to history
      historyRef.current.push(nextState);
      
      // Limit history size
      if (historyRef.current.length > maxHistory) {
        historyRef.current = historyRef.current.slice(-maxHistory);
      }
      
      indexRef.current = historyRef.current.length - 1;
      
      return nextState;
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current -= 1;
      isUndoRedoRef.current = true;
      setState(historyRef.current[indexRef.current]);
      return true;
    }
    return false;
  }, []);

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current += 1;
      isUndoRedoRef.current = true;
      setState(historyRef.current[indexRef.current]);
      return true;
    }
    return false;
  }, []);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  return {
    state,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
