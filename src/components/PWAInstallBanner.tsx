"use client";

import { useEffect, useState, useRef } from "react";

const IOS_STEPS = [
  <>Tap the <span className="text-accent-orange font-bold">Share</span> button <span className="text-white/40">(square with arrow)</span> at the bottom of Safari</>,
  <>Scroll and tap <span className="font-bold text-accent-orange">Add to Home Screen</span></>,
  <>Tap <span className="font-bold text-accent-orange">Add</span> — push notifications will work too!</>,
];

export default function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const isIOSRef = useRef(false);
  const deferredPromptRef = useRef<Event | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window.navigator as any).standalone === true) return;

    const dismissed = localStorage.getItem("pwa_install_dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

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
      setShowIOSGuide(true);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center w-full max-w-sm mx-6">
        {!showIOSGuide ? (
          <>
            <img src="/icons/kangaroo-like.png" alt="" width={80} height={80} className="mb-6 drop-shadow-lg" style={{ objectFit: "contain" }} />
            <h2 className="text-2xl font-black text-white mb-2 text-center">Add Count to Home</h2>
            <p className="text-sm text-white/50 text-center mb-8">Get the full app experience with push notifications</p>
            <button
              onClick={handleInstall}
              className="w-full py-4 bg-accent-orange text-white text-lg font-black rounded-2xl shadow-lg shadow-accent-orange/30 active:scale-95 transition-transform"
            >
              Add to Home Screen
            </button>
            <button onClick={dismiss} className="mt-4 text-sm text-white/30 active:text-white/50">
              Not now
            </button>
          </>
        ) : (
          <div className="bg-forest-dark border border-forest-light/20 rounded-2xl w-full p-6">
            <h3 className="text-lg font-bold text-white text-center mb-5">Almost there!</h3>
            <div className="space-y-4">
              {IOS_STEPS.map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="bg-accent-orange text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">{i + 1}</span>
                  <p className="text-sm text-white/80">{text}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowIOSGuide(false); dismiss(); }} className="mt-6 w-full py-3 bg-accent-orange text-white font-bold rounded-xl text-sm">
              Got it!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
