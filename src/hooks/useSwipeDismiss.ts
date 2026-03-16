import { useRef, useCallback } from "react";

const THRESHOLD = 80;

export function useSwipeDismiss(onDismiss: () => void) {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const elRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);
  const dismissed = useRef(false);

  const applyTransform = (dx: number, animate: boolean) => {
    const el = elRef.current;
    const bg = bgRef.current;
    if (!el) return;
    if (animate) {
      el.style.transition = "transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.3s ease";
    } else {
      el.style.transition = "none";
    }
    el.style.willChange = dx > 0 ? "transform, opacity" : "";
    el.style.transform = dx > 0 ? `translateX(${dx}px) scale(${Math.max(0.92, 1 - dx / 1200)})` : "";
    el.style.opacity = dx > 0 ? `${Math.max(0.2, 1 - dx / 350)}` : "";
    if (bg) {
      bg.style.transition = animate ? "opacity 0.3s ease" : "none";
      bg.style.opacity = dx > 0 ? `${Math.max(0.2, 1 - dx / 350)}` : "";
    }
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = 0;
    swiping.current = false;
    dismissed.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dismissed.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!swiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiping.current = true;
    }

    if (swiping.current && dx > 0) {
      currentX.current = dx;
      applyTransform(dx, false);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dismissed.current) return;
    if (currentX.current > THRESHOLD) {
      dismissed.current = true;
      // Animate out then dismiss
      applyTransform(window.innerWidth, true);
      setTimeout(() => {
        onDismiss();
        applyTransform(0, false);
      }, 300);
    } else {
      // Spring back
      applyTransform(0, true);
    }
    currentX.current = 0;
    swiping.current = false;
  }, [onDismiss]);

  const handlers = { onTouchStart, onTouchMove, onTouchEnd };
  return { handlers, ref: elRef, bgRef };
}
