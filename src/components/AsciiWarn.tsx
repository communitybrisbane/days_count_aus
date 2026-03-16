"use client";

export default function AsciiWarn({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
      <div className="bg-red-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
        English characters only
      </div>
    </div>
  );
}
