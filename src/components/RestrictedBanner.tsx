"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function RestrictedBanner() {
  const { profile } = useAuth();
  if (!profile?.restricted) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-red-600 text-white text-center px-4 py-3 text-xs leading-snug" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
      <p className="font-bold">This account has been restricted</p>
      <p className="mt-0.5 text-white/80">
        Inappropriate activity was detected on your account. To reactivate, please contact support.
      </p>
    </div>
  );
}

/** Hook to check if current user is restricted */
export function useRestricted(): boolean {
  const { profile } = useAuth();
  return profile?.restricted === true;
}
