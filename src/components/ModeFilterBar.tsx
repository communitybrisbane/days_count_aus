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
    <div className="flex justify-around px-4 py-2.5 bg-forest/50">
      <button
        onClick={() => onChange("")}
        aria-label="All"
        className={`${btnSize} rounded-full flex items-center justify-center text-sm font-bold ${
          !value ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
        }`}
      >
        All
      </button>
      {MAIN_MODE_OPTIONS.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          aria-label={m.id}
          className={`${btnSize} rounded-full flex items-center justify-center ${
            value === m.id ? "bg-accent-orange" : "bg-white"
          }`}
        >
          <FocusModeIcon modeId={m.id} size={iconSize} className={value === m.id ? "text-white" : "text-forest-mid"} />
        </button>
      ))}
    </div>
  );
}
