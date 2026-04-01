"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
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
    <div className={`flex gap-3 w-full overflow-x-auto scrollbar-hide px-2 ${className}`}>
      {groups.map((g) => {
        const modeInfo = FOCUS_MODES.find((m) => m.id === resolveMode(g.mode || ""));
        return (
          <button
            key={g.id}
            onClick={() => router.push(`/groups/${g.id}`)}
            className="flex flex-col items-center gap-1.5 rounded-xl px-4 py-3 min-w-[100px] shrink-0 active:bg-forest-light/20 transition-colors"
          >
            {g.iconUrl ? (
              <Image src={g.iconUrl} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
            ) : modeInfo ? (
              <div className="w-10 h-10 rounded-full bg-forest-mid/40 flex items-center justify-center">
                <FocusModeIcon modeId={modeInfo.id} size={20} className="text-white" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-forest-mid/40" />
            )}
            <p className="text-xs font-bold text-white/80 truncate w-full text-center">{g.groupName}</p>
          </button>
        );
      })}
    </div>
  );
}
