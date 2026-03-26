"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
      <img
        src="/icons/kangaroo-like.png"
        alt=""
        width={64}
        height={64}
        style={{ width: 64, height: 64, objectFit: "contain", opacity: 0.3 }}
        className="mb-4"
      />
      <h1 className="text-xl font-black text-white mb-2">Something went wrong</h1>
      <p className="text-sm text-white/40 mb-6 max-w-[280px]">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="px-8 py-3 bg-accent-orange text-white text-sm font-bold rounded-2xl active:scale-95 transition-transform"
      >
        Retry
      </button>
      <button
        onClick={() => (window.location.href = "/home")}
        className="mt-3 text-sm text-white/30 active:text-white/50"
      >
        Go to Home
      </button>
    </div>
  );
}
