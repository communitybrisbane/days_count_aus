/** Check if URL is a safe http(s) link */
export function isSafeUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

/** Today's date as YYYY-MM-DD string */
export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Generate a deterministic color from a UID string */
export function uidToColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/** Get initials from display name */
export function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

/** Calculate level from totalXP */
export function calculateLevel(totalXP: number): number {
  return Math.floor(Math.sqrt(totalXP / 6)) + 1;
}

/** Calculate XP needed for a given level */
export function xpForLevel(level: number): number {
  return Math.round((level - 1) ** 2 * 6);
}

/** Get progress percentage to next level */
export function levelProgress(totalXP: number): number {
  const currentLevel = calculateLevel(totalXP);
  const currentLevelXP = xpForLevel(currentLevel);
  const nextLevelXP = xpForLevel(currentLevel + 1);
  return ((totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
}

/** Convert Firestore Timestamp to Date */
export function timestampToDate(ts: unknown): Date | null {
  const t = ts as { toDate?: () => Date } | undefined;
  return t?.toDate?.() ?? null;
}

/** Calculate day count string based on phase and dates */
export function getDayCount(
  status: string,
  departureDate: string,
  returnStartDate?: string,
  createdAt?: Date | null
): { label: string; number: number } {
  const now = new Date(getTodayStr() + "T00:00:00");

  if (status === "pre-departure") {
    if (!departureDate) return { label: "D", number: 0 };
    const dep = new Date(departureDate + "T00:00:00");
    const diffDays = Math.ceil((dep.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    // 出発前: D-○日
    if (diffDays > 0) return { label: "D", number: -diffDays };
    // 出発日を過ぎたら自動的に D+ カウント（実質 In AUS と同じ計算）
    const passed = Math.floor((now.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { label: "D", number: passed };
  }

  if (status === "in-australia") {
    const dep = new Date(departureDate + "T00:00:00");
    const diff = Math.floor((now.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { label: "D", number: diff };
  }

  // post-return: count from app start date (createdAt)
  if (createdAt) {
    const start = new Date(createdAt.toISOString().slice(0, 10) + "T00:00:00");
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { label: "D", number: diff };
  }

  return { label: "D", number: 0 };
}

/** Get the most recent Tuesday 00:00 local time */
export function getCurrentTuesday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysSinceTuesday = (day + 5) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceTuesday, 0, 0, 0, 0);
}

/** Format day count for display */
export function formatDayCount(label: string, number: number): string {
  if (label === "D" && number < 0) {
    return `D - ${Math.abs(number)}`;
  }
  return `${label} + ${number}`;
}
