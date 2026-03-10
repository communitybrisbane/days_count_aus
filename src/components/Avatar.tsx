"use client";

import { uidToColor, getInitials } from "@/lib/utils";

interface AvatarProps {
  photoURL?: string;
  displayName: string;
  uid: string;
  size?: number;
  className?: string;
}

export default function Avatar({ photoURL, displayName, uid, size = 40, className = "" }: AvatarProps) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={displayName}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: uidToColor(uid),
        fontSize: size * 0.4,
      }}
    >
      {getInitials(displayName || "?")}
    </div>
  );
}
