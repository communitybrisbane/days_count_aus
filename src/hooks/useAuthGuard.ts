import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface AuthGuardOptions {
  requireProfile?: boolean;
}

export function useAuthGuard({ requireProfile = true }: AuthGuardOptions = {}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requireProfile && !profile) {
      router.replace("/onboarding");
    }
  }, [user, profile, loading, router, requireProfile]);

  return { user, profile, loading };
}
