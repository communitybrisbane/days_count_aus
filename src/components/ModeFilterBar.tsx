"use client";

import { MAIN_MODE_OPTIONS } from "@/lib/constants";
import { FocusModeIcon } from "@/components/icons";

interface Props {
  value: string;
  onChange: (mode: string) => void;
  size?: number;
}

export default function ModeFilterBar({ value, onChange, size = 12 }: Props) {
  const btnSize = size === 12 ? "w-12 h-12" : "w-14 h-14";
  const iconSize = size === 12 ? 28 : 33;

  return (
    <div className="flex justify-around items-center px-4 py-2">
      <button
        onClick={() => onChange("")}
        aria-label="All"
        className={`text-xs font-bold transition-colors ${
          !value ? "text-accent-orange" : "text-white/30"
        }`}
      >
        All
      </button>
      {MAIN_MODE_OPTIONS.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          aria-label={m.id}
          className="transition-colors"
        >
          <FocusModeIcon modeId={m.id} size={iconSize} className={value === m.id ? "text-accent-orange" : "text-white/30"} />
        </button>
      ))}
    </div>
  );
}
