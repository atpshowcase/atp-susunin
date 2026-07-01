import { useState, useCallback } from 'react';

export function useHistory<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const setWithHistory = useCallback((newStateOrUpdater: T | ((prev: T) => T)) => {
    setState((currentState) => {
      const newState = typeof newStateOrUpdater === 'function' 
        ? (newStateOrUpdater as (prev: T) => T)(currentState) 
        : newStateOrUpdater;

      // Only add to history if there is a real change (optional, but good practice)
      // Note: In React, if state is technically deeply equal, you might want to skip, 
      // but standard reference equality is usually fine.
      if (newState === currentState) return currentState;

      setPast((prevPast) => [...prevPast, currentState]);
      setFuture([]); // Clear future on new action
      return newState;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      
      const newPast = [...prevPast];
      const previousState = newPast.pop() as T;

      setState((currentState) => {
        setFuture((prevFuture) => [currentState, ...prevFuture]);
        return previousState;
      });

      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;

      const newFuture = [...prevFuture];
      const nextState = newFuture.shift() as T;

      setState((currentState) => {
        setPast((prevPast) => [...prevPast, currentState]);
        return nextState;
      });

      return newFuture;
    });
  }, []);

  const resetHistory = useCallback((newState: T) => {
    setState(newState);
    setPast([]);
    setFuture([]);
  }, []);

  return {
    state,
    setWithHistory,
    setStateWithoutHistory: setState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    resetHistory
  };
}
