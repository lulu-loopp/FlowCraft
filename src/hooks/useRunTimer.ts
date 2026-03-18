'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/** Returns formatted elapsed time string while `isRunning` is true. */
export function useRunTimer(isRunning: boolean): string {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    cleanup();
    if (!isRunning) return;
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 100);
    return cleanup;
  }, [isRunning, cleanup]);

  if (!isRunning) return '';
  const secs = Math.floor(elapsed / 1000);
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return mins > 0 ? `${mins}m ${s}s` : `${s}s`;
}
