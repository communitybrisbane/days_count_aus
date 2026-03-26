"use client";

import { useRouter } from "next/navigation";
import { FOCUS_MODES, resolveMode } from "@/lib/constants";
import { FocusModeIcon } from "@/components/icons";
import type { Group } from "@/types";

interface Props {
  groups: Group[];
  className?: string;
}

export default function ProfileGroups({ groups, className = "mt-3" }: Props) {
  const router = useRouter();

  if (groups.length === 0) return null;

  return (
    <div className={`flex gap-3 w-full justify-center overflow-x-hidden max-w-full ${className}`}>
      {groups.map((g) => {
        const modeInfo = FOCUS_MODES.find((m) => m.id === resolveMode(g.mode || ""));
        return (
          <button
            key={g.id}
            onClick={() => router.push(`/groups/${g.id}`)}
            className="flex flex-col items-center gap-1.5 rounded-xl px-4 py-3 min-w-[130px] max-w-[160px] active:bg-forest-light/20 transition-colors"
          >
            {g.iconUrl ? (
              <img src={g.iconUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : modeInfo ? (
              <div className="w-10 h-10 rounded-full bg-forest-mid/40 flex items-center justify-center">
                <FocusModeIcon modeId={modeInfo.id} size={20} className="text-white" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-forest-mid/40" />
            )}
            <p className="text-xs font-bold text-white/80 truncate w-full text-center">{g.groupName}</p>
            <p className="text-[10px] text-white/40">{g.memberCount}/10</p>
          </button>
        );
      })}
    </div>
  );
}
