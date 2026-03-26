"use client";

import { useEffect, useState, useRef } from "react";

/** SVG: iOS Safari share icon (square with up arrow) */
function ShareIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

/** SVG: plus in square (Add to Home Screen icon) */
function AddIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

/** Animated bouncing arrow pointing down */
function BouncingArrow() {
  return (
    <div className="flex flex-col items-center animate-bounce">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-orange">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
    </div>
  );
}

export default function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0); // 0 = intro, 1/2/3 = iOS steps
  const isIOSRef = useRef(false);
  const deferredPromptRef = useRef<Event | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window.navigator as any).standalone === true) return;

    const dismissed = localStorage.getItem("pwa_install_dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 30 * 24 * 60 * 60 * 1000) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    isIOSRef.current = ios;

    if (ios) {
      setShow(true);
    } else {
      const handler = (e: Event) => {
        e.preventDefault();
        deferredPromptRef.current = e;
        setShow(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("pwa_install_dismissed", String(Date.now()));
  };

  const handleInstall = async () => {
    if (isIOSRef.current) {
      setStep(1);
      return;
    }
    const prompt = deferredPromptRef.current;
    if (prompt) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prompt as any).prompt();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (prompt as any).userChoice;
      if (result.outcome === "accepted") setShow(false);
      deferredPromptRef.current = null;
    }
  };

  if (!show) return null;

  // ─── Step 0: Intro screen ───
  if (step === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="flex flex-col items-center w-full max-w-sm mx-6">
          <img src="/icons/kangaroo-like.png" alt="" width={80} height={80} className="mb-6 drop-shadow-lg" style={{ objectFit: "contain" }} />
          <h2 className="text-2xl font-black text-white mb-2 text-center">Add to Home Screen</h2>
          <p className="text-sm text-white/50 text-center mb-3">Use all features like a real app</p>

          {/* Feature list */}
          <div className="w-full space-y-2 mb-8">
            {[
              { icon: "🔔", label: "Push notifications" },
              { icon: "⚡", label: "Instant launch" },
              { icon: "📱", label: "Full screen experience" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                <span className="text-lg">{icon}</span>
                <span className="text-sm font-medium text-white/80">{label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleInstall}
            className="w-full py-4 bg-accent-orange text-white text-lg font-black rounded-2xl shadow-lg shadow-accent-orange/30 active:scale-95 transition-transform"
          >
            Setup Now
          </button>
          <button onClick={dismiss} className="mt-4 text-sm text-white/30 active:text-white/50">
            Later
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 1: Tap the Share button (bottom center) ───
  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm">
        {/* Top content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="bg-white/10 border border-white/20 rounded-full p-5 mb-5">
            <ShareIcon size={48} className="text-accent-orange" />
          </div>
          <p className="text-xl font-black text-white text-center mb-2">
            Step 1 of 3
          </p>
          <p className="text-base text-white/70 text-center">
            Tap the <span className="text-accent-orange font-bold">Share</span> button below
          </p>
        </div>

        {/* Arrow pointing to Safari share button */}
        <div className="flex flex-col items-center pb-3">
          <BouncingArrow />
          <div className="bg-accent-orange/20 border-2 border-accent-orange rounded-xl px-5 py-2.5 mb-2">
            <ShareIcon size={28} className="text-accent-orange" />
          </div>
          <p className="text-[11px] text-white/30 mb-1">Safari toolbar</p>
        </div>

        {/* Skip / Next */}
        <div className="flex justify-between px-6 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}>
          <button onClick={dismiss} className="text-sm text-white/30">Skip</button>
          <button onClick={() => setStep(2)} className="text-sm font-bold text-accent-orange">Next &rarr;</button>
        </div>
      </div>
    );
  }

  // ─── Step 2: Tap "Add to Home Screen" ───
  if (step === 2) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <p className="text-xl font-black text-white text-center mb-6">
            Step 2 of 3
          </p>
          <p className="text-base text-white/70 text-center mb-8">
            Scroll down and tap this option
          </p>

          {/* Mock menu item */}
          <div className="w-full max-w-xs">
            <div className="bg-white/5 rounded-xl px-4 py-3 mb-2 opacity-40">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-white/10" />
                <span className="text-sm text-white/40">Copy</span>
              </div>
            </div>
            <div className="bg-accent-orange/15 border-2 border-accent-orange rounded-xl px-4 py-3 relative">
              <div className="flex items-center gap-3">
                <AddIcon size={28} className="text-accent-orange shrink-0" />
                <span className="text-sm font-bold text-accent-orange">Add to Home Screen</span>
              </div>
              <div className="absolute -left-6 top-1/2 -translate-y-1/2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent-orange animate-pulse">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl px-4 py-3 mt-2 opacity-40">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-white/10" />
                <span className="text-sm text-white/40">Add Bookmark</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between px-6 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}>
          <button onClick={() => setStep(1)} className="text-sm text-white/30">&larr; Back</button>
          <button onClick={() => setStep(3)} className="text-sm font-bold text-accent-orange">Next &rarr;</button>
        </div>
      </div>
    );
  }

  // ─── Step 3: Tap "Add" ───
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm">
      {/* Mock top-right area */}
      <div className="flex justify-end px-4 pt-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}>
        <div className="bg-accent-orange/15 border-2 border-accent-orange rounded-lg px-5 py-2 relative">
          <span className="text-sm font-bold text-accent-orange">Add</span>
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent-orange animate-bounce">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <p className="text-xl font-black text-white text-center mb-4">
          Step 3 of 3
        </p>
        <p className="text-base text-white/70 text-center mb-2">
          Tap <span className="text-accent-orange font-bold">Add</span> in the top right
        </p>
        <p className="text-sm text-white/40 text-center">
          The app will appear on your home screen
        </p>
      </div>

      <div className="flex flex-col items-center px-6 pb-8 gap-3" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))" }}>
        <button
          onClick={dismiss}
          className="w-full max-w-xs py-4 bg-accent-orange text-white text-base font-black rounded-2xl shadow-lg shadow-accent-orange/30 active:scale-95 transition-transform"
        >
          Done!
        </button>
        <button onClick={() => setStep(2)} className="text-sm text-white/30">&larr; Back</button>
      </div>
    </div>
  );
}
