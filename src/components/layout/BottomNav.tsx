"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadGroups } from "@/hooks/useUnreadGroups";
import Avatar from "@/components/Avatar";
import { IconHome, IconDiary, IconCamera, IconGroup } from "@/components/icons";

interface BottomNavProps {
  onExploreClick?: () => void;
  onMyClick?: () => void;
}

export default function BottomNav({ onExploreClick, onMyClick }: BottomNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user } = useAuth();
  const { totalUnread } = useUnreadGroups(user?.uid, profile?.groupIds || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const handlePostClick = () => {
    // If already on post page, do nothing special
    if (isActive("/post")) return;
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so same file can be re-selected
    e.target.value = "";
    if (file) {
      // Store blob URL (avoids sessionStorage size limit for large photos)
      const blobUrl = URL.createObjectURL(file);
      sessionStorage.setItem("post_image", blobUrl);
      router.push("/post");
    } else {
      // User cancelled file picker — navigate without image
      sessionStorage.removeItem("post_image");
      router.push("/post");
    }
  };

  return (
    <nav className="fixed left-1/2 -translate-x-1/2 w-full max-w-[450px] bg-forest/95 backdrop-blur-md border-t border-forest-light/30 z-50" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) / 2)" }}>
      {/* Hidden file input for post image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        className="hidden"
      />

      <div className="flex items-center justify-around h-10 px-2">
        {/* HOME */}
        <Link href="/home" className="flex items-center justify-center w-10 h-10">
          <IconHome size={28} className={isActive("/home") ? "text-accent-orange" : "text-white/40"} />
        </Link>

        {/* EXPLORE */}
        {onExploreClick ? (
          <button onClick={onExploreClick} className="flex items-center justify-center w-10 h-10">
            <IconDiary size={28} className="text-accent-orange" />
          </button>
        ) : (
          <Link href="/explore" className="flex items-center justify-center w-10 h-10">
            <IconDiary size={28} className={isActive("/explore") ? "text-accent-orange" : "text-white/40"} />
          </Link>
        )}

        {/* POST — center floating, opens file picker first */}
        <button onClick={handlePostClick} className="flex items-center justify-center -mt-4">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-long ${
              isActive("/post") ? "bg-gradient-to-br from-accent-orange to-accent-orange-dark" : "bg-gradient-to-br from-accent-orange-light to-accent-orange"
            }`}
          >
            <IconCamera size={30} className="text-white" />
          </div>
        </button>

        {/* GROUPS */}
        <Link href="/groups" className="relative flex items-center justify-center w-10 h-10">
          <IconGroup size={28} className={isActive("/groups") ? "text-accent-orange" : "text-white/40"} />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </Link>

        {/* MY */}
        {onMyClick ? (
          <button onClick={onMyClick} className="flex items-center justify-center w-10 h-10">
            <div className="rounded-full ring-2 ring-accent-orange">
              <Avatar
                photoURL={profile?.photoURL}
                displayName={profile?.displayName || "?"}
                uid={user?.uid || ""}
                size={30}
              />
            </div>
          </button>
        ) : (
          <Link href="/mypage" className="flex items-center justify-center w-10 h-10">
            <div className={`rounded-full ${isActive("/mypage") ? "ring-2 ring-accent-orange" : ""}`}>
              <Avatar
                photoURL={profile?.photoURL}
                displayName={profile?.displayName || "?"}
                uid={user?.uid || ""}
                size={30}
              />
            </div>
          </Link>
        )}
      </div>
    </nav>
  );
}
