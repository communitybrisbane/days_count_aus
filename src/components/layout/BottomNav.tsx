"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { IconHome, IconDiary, IconCamera, IconGroup } from "@/components/icons";

interface BottomNavProps {
  onExploreClick?: () => void;
  onMyClick?: () => void;
}

export default function BottomNav({ onExploreClick, onMyClick }: BottomNavProps = {}) {
  const pathname = usePathname();
  const { profile, user } = useAuth();

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[450px] bg-white border-t border-gray-100 z-50" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-around h-16 px-2">
        {/* HOME */}
        <Link href="/home" className="flex items-center justify-center w-14 h-14">
          <IconHome size={26} className={isActive("/home") ? "text-aussie-gold" : "text-gray-400"} />
        </Link>

        {/* EXPLORE */}
        {onExploreClick ? (
          <button onClick={onExploreClick} className="flex items-center justify-center w-14 h-14">
            <IconDiary size={26} className="text-aussie-gold" />
          </button>
        ) : (
          <Link href="/explore" className="flex items-center justify-center w-14 h-14">
            <IconDiary size={26} className={isActive("/explore") ? "text-aussie-gold" : "text-gray-400"} />
          </Link>
        )}

        {/* POST — center floating */}
        <Link href="/post" className="flex items-center justify-center -mt-6">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${
              isActive("/post") ? "bg-aussie-gold" : "bg-aussie-gold/90"
            }`}
          >
            <IconCamera size={28} className="text-white" />
          </div>
        </Link>

        {/* GROUPS */}
        <Link href="/groups" className="flex items-center justify-center w-14 h-14">
          <IconGroup size={26} className={isActive("/groups") ? "text-aussie-gold" : "text-gray-400"} />
        </Link>

        {/* MY */}
        {onMyClick ? (
          <button onClick={onMyClick} className="flex items-center justify-center w-14 h-14">
            <div className="rounded-full ring-2 ring-aussie-gold">
              <Avatar
                photoURL={profile?.photoURL}
                displayName={profile?.displayName || "?"}
                uid={user?.uid || ""}
                size={28}
              />
            </div>
          </button>
        ) : (
          <Link href="/mypage" className="flex items-center justify-center w-14 h-14">
            <div className={`rounded-full ${isActive("/mypage") ? "ring-2 ring-aussie-gold" : ""}`}>
              <Avatar
                photoURL={profile?.photoURL}
                displayName={profile?.displayName || "?"}
                uid={user?.uid || ""}
                size={28}
              />
            </div>
          </Link>
        )}
      </div>
    </nav>
  );
}
