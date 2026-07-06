"use client";

import { useEffect, useRef, useState } from "react";
import { REGIONS } from "@/lib/constants";

const ITEM_H = 40; // px per wheel row
const VISIBLE_ROWS = 5;
const PAD = (ITEM_H * (VISIBLE_ROWS - 1)) / 2;

/** Bottom-sheet drum-style (iOS wheel) region picker */
export default function RegionWheelModal({ value, onDone, onClose }: {
  value?: string;
  onDone: (region: string) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const regions = REGIONS as readonly string[];
  const [idx, setIdx] = useState(() => {
    const i = regions.indexOf(value || "");
    return i >= 0 ? i : 0;
  });

  // Position the wheel on the current value when opened
  useEffect(() => {
    listRef.current?.scrollTo({ top: idx * ITEM_H });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setIdx(Math.min(regions.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H))));
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-2xl animate-slide-up"
        style={{ paddingBottom: "max(0.5rem, var(--safe-bottom, 0px))" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-400 active:text-gray-600">Cancel</button>
          <h3 className="font-bold text-sm">Select Region</h3>
          <button onClick={() => onDone(regions[idx])} className="text-sm font-bold text-accent-orange active:opacity-70">Done</button>
        </div>

        <div className="relative mx-6 my-2">
          {/* Center highlight band */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 rounded-xl bg-accent-orange/10 border-y-2 border-accent-orange/30" />
          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent z-10" />

          <div
            ref={listRef}
            onScroll={handleScroll}
            className="overflow-y-auto snap-y snap-mandatory scrollbar-hide"
            style={{ height: ITEM_H * VISIBLE_ROWS, paddingTop: PAD, paddingBottom: PAD }}
          >
            {regions.map((r, i) => (
              <div
                key={r}
                onClick={() => listRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" })}
                className={`flex items-center justify-center snap-center cursor-pointer transition-colors ${
                  i === idx ? "text-base font-bold text-forest" : "text-sm text-gray-400"
                }`}
                style={{ height: ITEM_H }}
              >
                {r}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
