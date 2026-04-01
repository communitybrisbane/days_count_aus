import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const defaults = { size: 24, className: "", strokeWidth: 2.2 };

function p(props: IconProps) {
  return { ...defaults, ...props };
}

// ─── Kangaroo Like Icon (from app design PNG) ───

export function IconKangaroo({ size = 24, filled, className = "" }: { size?: number; filled?: boolean; className?: string }) {
  return (
    <img
      src="/icons/kangaroo-like.png"
      alt=""
      width={size}
      height={size}
      className={className}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: filled ? "none" : "grayscale(1) opacity(0.45)",
        transition: "filter 0.2s ease",
      }}
    />
  );
}

// ─── Navigation (unified: 24x24, stroke-only, thick rounded) ───

export function IconHome({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M5 9.5V19a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V9.5" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconDiary({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M8 7h8M8 11h5" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconBoomerang({ size, className, strokeWidth, filled }: IconProps & { filled?: boolean }) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 4.5c0 0 1.5-1.5 5-1.5 2.5 0 4.5 1 5.5 2.5s1.5 3.5 1 5.5M4.5 4.5c0 0-1.5 1.5-1.5 5 0 2.5 1 4.5 2.5 5.5s3.5 1.5 5.5 1M4.5 4.5l2 2M13 14c-1 .5-2.5.5-3.5 0s-2-1.5-2-3" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

// Simple eucalyptus-style leaf icon
export function IconEucalyptus({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c-3 2-5 5.5-5 9 0 3.5 2 6 5 9 3-3 5-5.5 5-9 0-3.5-2-7-5-9z" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M12 7c-1.5 1-2.5 2.5-2.5 4.2 0 1.7 1 3.1 2.5 4.3 1.5-1.2 2.5-2.6 2.5-4.3C14.5 9.5 13.5 8 12 7z" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M12 2v3" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconGroup({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M2 20v-1.5C2 15.5 5.1 13 9 13s7 2.5 7 5.5V20" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <circle cx="17.5" cy="9" r="2.5" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M18 13.5c2 .5 4 2 4 4.5v2" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

// ─── Interaction ───

export function IconFire({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A5.5 5.5 0 0 0 12 21a5.5 5.5 0 0 0 3.5-6.5C14.5 11 12 9 12 9s-1 2.5-3.5 5.5z" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M12 9c0-3-1.5-5-2.5-6 0 3.5-2.5 6-3.5 8a8 8 0 0 0 12 7c-1-1-2.5-3-3-5" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconLock({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconGlobe({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M3 12h18" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconSettings({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.5.5 1.2.67 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.62.18 1.32-.33 1.82" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconCamera({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconEdit({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconPencil({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconTrash({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconSearch({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

// ─── Focus Modes ───

export function IconCoin({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5s-2 .5-2 1.5 1 1.5 2.5 2 2.5 1 2.5 2-1 1.5-2.5 1.5-2-.5-2.5-1.5" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M12 6.5v1M12 16.5v1" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconSpeaking({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="3.5" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M3 20v-1c0-2.8 2.7-5 6.5-5h1c3.8 0 6.5 2.2 6.5 5v1" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <text x="19" y="9" textAnchor="middle" fill="currentColor" fontSize="6" fontWeight="bold" fontFamily="sans-serif" style={{ letterSpacing: "-0.5px" }}>AB</text>
    </svg>
  );
}

export function IconCoffee({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconLaptop({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M2 20h20" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

// ─── Milestones ───

export function IconParty({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.8 11.3L2 22l10.7-3.8" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M4 3h.01M22 8h.01M17 2h.01M22 16h.01" stroke="currentColor" strokeWidth={2.5} />
      <path d="M12.7 11.3a4.5 4.5 0 0 0-6.4 0" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M9.7 8.3a8.5 8.5 0 0 1 6 2.5" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M13.2 5.3a12.5 12.5 0 0 1 5.7 3.7" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconMuscle({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11c-1.5-2-2-4-1.5-6 .5-1.5 2-2.5 3.5-2.5 2 0 3 1.5 3 3s.5 3 2 4c1.5 1 3 1.5 3.5 3s0 3-1 4-2.5 2-4 2-3-.5-4-1.5c-1.5-1.5-2.5-4-1.5-6z" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M14 14c.5.5 1.5 1 2.5 1" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconTrophy({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M18 9h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M6 4h12v6a6 6 0 0 1-12 0V4z" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M12 16v3" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M8 22h8" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M9 19h6" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconUsers({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconFlag({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

export function IconBan({ size, className, strokeWidth }: IconProps) {
  const d = p({ size, className, strokeWidth });
  return (
    <svg width={d.size} height={d.size} viewBox="0 0 24 24" fill="none" className={d.className} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={d.strokeWidth} />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth={d.strokeWidth} />
    </svg>
  );
}

// ─── Utility: render focus mode icon by id ───

export function FocusModeIcon({ modeId, ...props }: IconProps & { modeId: string }) {
  switch (modeId) {
    // Current modes
    case "work": return <IconCoin {...props} />;
    case "english": return <IconSpeaking {...props} />;
    case "skill": case "skills": return <IconLaptop {...props} />;
    case "challenge": case "enjoying": case "challenging": case "adventure":
      return <img src="/icons/kangaroo-like.png" alt="" width={props.size ?? 24} height={props.size ?? 24} className={props.className} draggable={false} style={{ width: props.size ?? 24, height: props.size ?? 24, objectFit: "contain" }} />;
    case "chill": case "social-media": case "daily": return <IconCoffee {...props} />;
    default: return <IconGlobe {...props} />;
  }
}

// ─── Utility: render milestone icon by day number ───

export function MilestoneIcon({ dayNumber, ...props }: IconProps & { dayNumber: number }) {
  if (dayNumber >= 365) return <IconTrophy {...props} />;
  if (dayNumber >= 200) return <IconMuscle {...props} />;
  if (dayNumber >= 100) return <IconFire {...props} />;
  return <IconParty {...props} />;
}
