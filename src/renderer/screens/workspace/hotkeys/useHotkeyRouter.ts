import { useCallback, useEffect, useRef } from 'react';

type HotkeyHandler = (event: KeyboardEvent) => boolean;

type HotkeyHandlerRegistration = {
  handler: HotkeyHandler;
  priority?: number;
};

export type HotkeyRouterReturn = {
  registerHotkeyHandler: (registration: HotkeyHandlerRegistration) => () => void;
};

type HotkeyHandlerEntry = {
  id: number;
  priority: number;
  handler: HotkeyHandler;
};

const sortByPriority = (a: HotkeyHandlerEntry, b: HotkeyHandlerEntry) => {
  if (a.priority === b.priority) return a.id - b.id;
  return b.priority - a.priority;
};

export function useHotkeyRouter(): HotkeyRouterReturn {
  const handlerIdRef = useRef(0);
  const handlersRef = useRef<HotkeyHandlerEntry[]>([]);

  const registerHotkeyHandler = useCallback((registration: HotkeyHandlerRegistration) => {
    const id = (handlerIdRef.current += 1);
    const entry: HotkeyHandlerEntry = {
      id,
      priority: registration.priority ?? 0,
      handler: registration.handler,
    };
    handlersRef.current = [...handlersRef.current, entry].sort(sortByPriority);

    return () => {
      handlersRef.current = handlersRef.current.filter((existing) => existing.id !== id);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      for (const entry of handlersRef.current) {
        if (entry.handler(event)) {
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return { registerHotkeyHandler };
}

export default useHotkeyRouter;
