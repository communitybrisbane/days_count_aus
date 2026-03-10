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
  return Math.floor(Math.sqrt(totalXP / 4)) + 1;
}

/** Calculate XP needed for a given level */
export function xpForLevel(level: number): number {
  return Math.round((level - 1) ** 2 * 4);
}

/** Get progress percentage to next level */
export function levelProgress(totalXP: number): number {
  const currentLevel = calculateLevel(totalXP);
  const currentLevelXP = xpForLevel(currentLevel);
  const nextLevelXP = xpForLevel(currentLevel + 1);
  return ((totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
}

/** Calculate day count string based on phase and dates */
export function getDayCount(
  status: string,
  departureDate: string,
  returnStartDate?: string
): { label: string; number: number } {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (status === "pre-departure") {
    const dep = new Date(departureDate + "T00:00:00");
    const now = new Date(todayStr + "T00:00:00");
    const diff = Math.ceil((dep.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { label: "D", number: -diff };
  }

  if (status === "in-australia") {
    const dep = new Date(departureDate + "T00:00:00");
    const now = new Date(todayStr + "T00:00:00");
    const diff = Math.floor((now.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { label: "D", number: diff };
  }

  // post-return
  if (returnStartDate) {
    const ret = new Date(returnStartDate + "T00:00:00");
    const now = new Date(todayStr + "T00:00:00");
    const diff = Math.floor((now.getTime() - ret.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { label: "R", number: diff };
  }

  return { label: "D", number: 0 };
}

/** Format day count for display */
export function formatDayCount(label: string, number: number): string {
  if (label === "D" && number < 0) {
    return `D - ${Math.abs(number)}`;
  }
  return `${label} + ${number}`;
}
