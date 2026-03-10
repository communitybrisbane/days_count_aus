"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { IconHome, IconDiary, IconCamera, IconGroup } from "@/components/icons";

export default function BottomNav() {
  const pathname = usePathname();
  const { profile, user } = useAuth();

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[450px] bg-white border-t border-gray-100 z-50">
      <div className="flex items-center justify-around h-14 px-2">
        {/* HOME */}
        <Link href="/home" className="flex items-center justify-center w-12 h-12">
          <IconHome size={24} className={isActive("/home") ? "text-aussie-gold" : "text-gray-400"} />
        </Link>

        {/* EXPLORE */}
        <Link href="/explore" className="flex items-center justify-center w-12 h-12">
          <IconDiary size={24} className={isActive("/explore") ? "text-aussie-gold" : "text-gray-400"} />
        </Link>

        {/* POST — center floating */}
        <Link href="/post" className="flex items-center justify-center -mt-6">
          <div
            className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg ${
              isActive("/post") ? "bg-aussie-gold" : "bg-aussie-gold/90"
            }`}
          >
            <IconCamera size={26} className="text-white" />
          </div>
        </Link>

        {/* GROUPS */}
        <Link href="/groups" className="flex items-center justify-center w-12 h-12">
          <IconGroup size={24} className={isActive("/groups") ? "text-aussie-gold" : "text-gray-400"} />
        </Link>

        {/* MY */}
        <Link href="/mypage" className="flex items-center justify-center w-12 h-12">
          <div className={`rounded-full ${isActive("/mypage") ? "ring-2 ring-aussie-gold" : ""}`}>
            <Avatar
              photoURL={profile?.photoURL}
              displayName={profile?.displayName || "?"}
              uid={user?.uid || ""}
              size={26}
            />
          </div>
        </Link>
      </div>
    </nav>
  );
}
