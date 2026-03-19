"use client";

export default function AsciiWarn({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="text-red-400 text-xs font-bold mt-1">
      English characters only
    </p>
  );
}
