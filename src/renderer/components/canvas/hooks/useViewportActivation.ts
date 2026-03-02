import { useEffect, useState, type RefObject } from 'react';

interface UseViewportActivationOptions {
  rootMargin?: string;
  threshold?: number;
  onceVisible?: boolean;
}

export function useViewportActivation(
  elementRef: RefObject<Element | null>,
  options: UseViewportActivationOptions = {}
): boolean {
  const { rootMargin = '120px', threshold = 0, onceVisible = true } = options;
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return true;
    return typeof window.IntersectionObserver !== 'function';
  });

  useEffect(() => {
    if (active && onceVisible) return;

    const element = elementRef.current;
    if (!element) return;

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      setActive(true);
      return;
    }

    let cancelled = false;
    const root = element instanceof HTMLElement ? element.closest('.canvas') : null;
    const observer = new window.IntersectionObserver(
      (entries) => {
        const intersects = entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0);
        if (!intersects) {
          if (!onceVisible && !cancelled) {
            setActive(false);
          }
          return;
        }
        if (cancelled) return;
        setActive(true);
        if (onceVisible) {
          observer.disconnect();
        }
      },
      {
        root: root ?? null,
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [active, elementRef, onceVisible, rootMargin, threshold]);

  return active;
}
