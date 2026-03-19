"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!profile) {
      router.replace("/onboarding");
    } else {
      router.replace("/home");
    }
  }, [user, profile, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-dvh">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-orange" />
    </div>
  );
}
