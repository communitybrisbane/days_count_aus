import Link from "next/link";
import { FOCUS_MODES } from "@/lib/constants";
import { IconLock, FocusModeIcon } from "@/components/icons";
import type { Group } from "@/types";

interface GroupCardProps {
  group: Group;
  currentUserId?: string;
}

export default function GroupCard({ group, currentUserId }: GroupCardProps) {
  const modeInfo = FOCUS_MODES.find((m) => m.id === group.mode);
  const isFull = group.memberCount >= 10;
  const isMember = group.memberIds?.includes(currentUserId || "");
  const hasPassword = !!group.password;

  return (
    <Link
      href={`/groups/${group.id}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        {group.iconUrl ? (
          <img src={group.iconUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <FocusModeIcon modeId={group.mode || "challenging"} size={26} className="text-gray-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-sm truncate">{group.groupName}</p>
            {group.isOfficial && <span className="text-[10px] bg-aussie-gold text-white px-1.5 py-0.5 rounded-full">Official</span>}
            {hasPassword && <IconLock size={12} className="text-gray-400 shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
            {modeInfo && (
              <span className="flex items-center gap-0.5">
                <FocusModeIcon modeId={modeInfo.id} size={10} className="text-gray-400" />
                {modeInfo.description}
              </span>
            )}
            <span>· {group.isOfficial ? `${group.memberCount} members` : `${group.memberCount}/10`}</span>
            {isMember && <span className="text-ocean-blue font-medium">· Joined</span>}
          </div>
        </div>
        {!group.isOfficial && isFull && (
          <span className="bg-red-100 text-red-500 text-xs font-bold px-2 py-1 rounded-full shrink-0">
            FULL
          </span>
        )}
      </div>
      <div className="pb-2" />
    </Link>
  );
}
