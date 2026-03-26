"use client";

import { WEEKLY_XP, WEEK_STREAK_BONUS, WEEK_STREAK_MAX } from "@/lib/constants";
import { getCurrentTuesday } from "@/lib/utils";

interface Props {
  weekStreak: number;
  weeklyPostCount: number;
  goalCleared: boolean;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getWeekRange(): string {
  const tue = getCurrentTuesday();
  const mon = new Date(tue);
  mon.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${MONTH_ABBR[d.getMonth()]}. ${d.getDate()}`;
  return `${fmt(tue)} – ${fmt(mon)}`;
}

// Streak badge accent — subtle color shift as streak grows
function getStreakAccent(ws: number) {
  if (ws === 0) return { ring: "ring-white/10", text: "text-white/40", glow: "" };
  if (ws <= 2) return { ring: "ring-accent-orange/40", text: "text-accent-orange", glow: "" };
  if (ws <= 5) return { ring: "ring-amber-400/50", text: "text-amber-400", glow: "" };
  if (ws <= 8) return { ring: "ring-lime/50", text: "text-lime", glow: "" };
  return { ring: "ring-aussie-gold/60", text: "text-aussie-gold", glow: "shadow-[0_0_12px_rgba(255,184,0,0.25)]" };
}

export default function WeeklyChallenge({ weekStreak, weeklyPostCount, goalCleared }: Props) {
  const ws = Math.min(weekStreak, WEEK_STREAK_MAX);
  const accent = getStreakAccent(ws);

  return (
    <div className="bg-forest rounded-2xl px-4 pt-4 pb-3 space-y-3">
      {/* Header row: week range + streak badge */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40 font-medium tracking-wide">{getWeekRange()}</span>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ${accent.ring} ${accent.glow} bg-white/5`}>
          <span className={`text-[11px] font-black ${accent.text} tabular-nums`}>
            {ws} day streak{ws >= WEEK_STREAK_MAX ? " MAX" : ""}
          </span>
          {ws > 0 && (
            <span className="text-[9px] text-white/30 font-medium">+{ws * WEEK_STREAK_BONUS}/post</span>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1.5">
        {WEEKLY_XP.map((baseXp, i) => {
          const filled = i < weeklyPostCount;
          const isNext = i === weeklyPostCount && !goalCleared;
          const barHeight = 18 + i * 7;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              {/* XP label */}
              <span className={`text-[9px] font-bold tabular-nums ${
                filled ? "text-accent-orange" : isNext ? "text-white/50" : "text-white/15"
              }`}>
                +{baseXp}
              </span>

              {/* Bar */}
              <div
                className={`w-full rounded-md transition-all duration-500 ${
                  filled
                    ? goalCleared
                      ? "bg-gradient-to-t from-accent-orange to-aussie-gold shadow-[0_0_8px_rgba(255,109,0,0.3)]"
                      : "bg-gradient-to-t from-accent-orange/90 to-accent-orange-light/80"
                    : isNext
                      ? "bg-white/15 ring-1 ring-white/20"
                      : "bg-white/[0.06]"
                }`}
                style={{ height: `${barHeight}px` }}
              />

              {/* Day number */}
              <span className={`text-[9px] font-bold tabular-nums ${
                filled ? "text-white/60" : "text-white/20"
              }`}>
                {i + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* Next XP hint */}
      {!goalCleared && weeklyPostCount < 7 && (
        <div className="flex justify-end pt-2 border-t border-white/[0.06]">
          <span className="text-[11px] text-white/30">
            next: <span className="font-bold text-white/60">+{WEEKLY_XP[weeklyPostCount]}</span>
            {ws > 0 && (
              <span className="font-bold text-accent-orange"> +{ws * WEEK_STREAK_BONUS}</span>
            )}
            <span> XP</span>
          </span>
        </div>
      )}

      {/* Completion badge */}
      {goalCleared && (
        <div className="flex justify-center pt-1">
          <span className="text-[10px] font-black text-forest bg-gradient-to-r from-accent-orange to-aussie-gold px-3 py-0.5 rounded-full">
            WEEKLY COMPLETE
          </span>
        </div>
      )}
    </div>
  );
}
