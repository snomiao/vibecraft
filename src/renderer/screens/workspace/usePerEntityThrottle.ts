import { useCallback, useEffect, useRef } from 'react';

type ScheduleOptions = {
  force?: boolean;
};

type UsePerEntityThrottleParams<T> = {
  intervalMs: number;
  onFlush: (id: string, payload: T) => Promise<void> | void;
};

type UsePerEntityThrottleReturn<T> = {
  schedule: (id: string, payload: T, options?: ScheduleOptions) => void;
  flush: (id: string) => void;
  clear: (id: string) => void;
};

export function usePerEntityThrottle<T>({
  intervalMs,
  onFlush,
}: UsePerEntityThrottleParams<T>): UsePerEntityThrottleReturn<T> {
  const lastFlushAtRef = useRef<Map<string, number>>(new Map());
  const pendingPayloadRef = useRef<Map<string, T>>(new Map());
  const timerByIdRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const timer = timerByIdRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerByIdRef.current.delete(id);
    }
  }, []);

  const flushNow = useCallback(
    (id: string, payload: T) => {
      clearTimer(id);
      pendingPayloadRef.current.delete(id);
      lastFlushAtRef.current.set(id, Date.now());
      try {
        const result = onFlush(id, payload);
        void Promise.resolve(result).catch((error) => {
          console.warn('Throttled flush failed', { id, error });
        });
      } catch (error) {
        console.warn('Throttled flush failed', { id, error });
      }
    },
    [clearTimer, onFlush]
  );

  const flush = useCallback(
    (id: string) => {
      const payload = pendingPayloadRef.current.get(id);
      if (payload === undefined) {
        clearTimer(id);
        return;
      }
      flushNow(id, payload);
    },
    [clearTimer, flushNow]
  );

  const schedule = useCallback(
    (id: string, payload: T, options?: ScheduleOptions) => {
      pendingPayloadRef.current.set(id, payload);
      const force = options?.force ?? false;
      const now = Date.now();
      const lastFlushAt = lastFlushAtRef.current.get(id) ?? 0;
      const elapsed = now - lastFlushAt;

      if (force || elapsed >= intervalMs) {
        flushNow(id, payload);
        return;
      }

      if (timerByIdRef.current.has(id)) {
        return;
      }

      const remaining = Math.max(0, intervalMs - elapsed);
      const timer = setTimeout(() => {
        timerByIdRef.current.delete(id);
        flush(id);
      }, remaining);
      timerByIdRef.current.set(id, timer);
    },
    [flush, flushNow, intervalMs]
  );

  const clear = useCallback(
    (id: string) => {
      clearTimer(id);
      pendingPayloadRef.current.delete(id);
      lastFlushAtRef.current.delete(id);
    },
    [clearTimer]
  );

  useEffect(() => {
    const timers = timerByIdRef.current;
    const pending = pendingPayloadRef.current;
    const lastFlushAt = lastFlushAtRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      pending.clear();
      lastFlushAt.clear();
    };
  }, []);

  return {
    schedule,
    flush,
    clear,
  };
}

export default usePerEntityThrottle;
