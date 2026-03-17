import { useMemo } from "react";
import { getDayCount, timestampToDate } from "@/lib/utils";
import type { UserProfile } from "@/types";

export function useDayCount(profile: UserProfile | null) {
  const createdAtDate = useMemo(
    () => timestampToDate(profile?.createdAt),
    [profile]
  );

  return useMemo(() => {
    if (!profile) return { label: "D", number: 0 };
    return getDayCount(
      profile.status || "pre-departure",
      profile.departureDate || "",
      profile.returnStartDate,
      createdAtDate
    );
  }, [profile, createdAtDate]);
}
