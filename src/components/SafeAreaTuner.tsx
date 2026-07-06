"use client";

import { useEffect } from "react";

/**
 * In standalone PWA mode, newer iOS versions end the layout viewport above the
 * physical screen bottom (the OS reserves the home-indicator zone itself) while
 * still reporting a non-zero env(safe-area-inset-bottom). Adding our own
 * safe-area padding on top of that doubles the gap under the bottom nav.
 * Detect the reserved zone at runtime and zero out --safe-bottom when present.
 */
export default function SafeAreaTuner() {
  useEffect(() => {
    if (!window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches) return;

    const tune = () => {
      const shortfall = window.screen.height - window.innerHeight;
      if (shortfall > 8) {
        document.documentElement.style.setProperty("--safe-bottom", "0px");
        // Sink the bottom nav halfway into the OS-reserved zone below the viewport
        document.documentElement.style.setProperty("--nav-sink", `${Math.round(shortfall / 2)}px`);
      } else {
        document.documentElement.style.removeProperty("--safe-bottom");
        document.documentElement.style.removeProperty("--nav-sink");
      }
    };

    tune();
    window.addEventListener("resize", tune);
    return () => window.removeEventListener("resize", tune);
  }, []);

  return null;
}
