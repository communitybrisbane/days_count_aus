"use client";

import { useEffect, useState } from "react";
import { fetchWeeklyHistory } from "@/lib/services/posts";
import { FOCUS_MODES, GOAL_MAX } from "@/lib/constants";
import { FocusModeIcon } from "@/components/icons";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";

// Mode colors for stacked bars
const MODE_BAR_COLORS: Record<string, string> = {
  english: "#3B82F6",   // blue
  skill: "#8B5CF6",     // violet
  adventure: "#10B981", // emerald
  work: "#F97316",      // orange
  chill: "#78716C",     // stone
};

// Mode order for consistent stacking
const MODE_ORDER = ["english", "skill", "adventure", "work", "chill"];

// Rainbow streak text colors matching WeeklyChallenge
const STREAK_TEXT_COLORS = [
  "text-gray-500",      // 0
  "text-red-500",       // 1
  "text-orange-500",    // 2
  "text-yellow-600",    // 3
  "text-emerald-600",   // 4
  "text-cyan-600",      // 5
  "text-blue-600",      // 6
  "text-purple-600",    // 7
  "text-pink-500",      // 8
  "text-amber-600",     // 9
  "text-fuchsia-600",   // 10+ (rainbow)
];

function getStreakTextColor(streak: number) {
  return STREAK_TEXT_COLORS[Math.min(streak, STREAK_TEXT_COLORS.length - 1)];
}

function formatWeekLabel(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${m}/${d}`;
}

interface WeekData {
  weekStart: Date;
  count: number;
  uniqueDays: number;
  modes: Record<string, number>;
}

interface Props {
  uid: string;
  goal: string;
  onClose: () => void;
  onSaveGoal: (goal: string) => void;
}

export default function WeeklyHistoryModal({ uid, goal, onClose, onSaveGoal }: Props) {
  const { showWarn, sanitize } = useAsciiInput();
  const [history, setHistory] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalDraft, setGoalDraft] = useState(goal);

  useEffect(() => {
    fetchWeeklyHistory(uid, 12).then((data) => {
      setHistory(data);
      setLoading(false);
    });
  }, [uid]);

  // Calculate streaks: consecutive weeks with 5+ unique posting days
  const streaks: number[] = [];
  let currentStreak = 0;
  for (const week of history) {
    if (week.uniqueDays >= 5) {
      currentStreak++;
    } else {
      currentStreak = 0;
    }
    streaks.push(currentStreak);
  }

  const maxCount = Math.max(...history.map((w) => w.count), 7);

  // Total mode counts across all weeks
  const totalModes: Record<string, number> = {};
  history.forEach((w) => {
    Object.entries(w.modes).forEach(([mode, count]) => {
      totalModes[mode] = (totalModes[mode] || 0) + count;
    });
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-x-0 z-50 bg-white rounded-t-2xl" role="dialog" aria-modal="true" style={{ bottom: "4rem" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-sm text-gray-800">Goal & History</h3>
          <button onClick={onClose} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center" aria-label="Close">&times;</button>
        </div>

        <div className="px-4 pt-3 pb-3 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {/* Goal edit */}
          <div className="mb-4">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">My Goal</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                maxLength={GOAL_MAX}
                value={goalDraft}
                onChange={(e) => setGoalDraft(sanitize(e.target.value))}
                placeholder="What are you working towards?"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
              />
              <button
                onClick={() => onSaveGoal(goalDraft.trim())}
                disabled={goalDraft.trim() === goal}
                className="px-3 py-2 bg-accent-orange text-white text-xs font-bold rounded-lg disabled:opacity-30 shrink-0"
              >
                Save
              </button>
            </div>
            <AsciiWarn show={showWarn} />
          </div>

          {/* Mode legend */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {MODE_ORDER.map((modeId) => {
              const mode = FOCUS_MODES.find((m) => m.id === modeId);
              if (!mode || !totalModes[modeId]) return null;
              return (
                <div key={modeId} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: MODE_BAR_COLORS[modeId] }} />
                  <FocusModeIcon modeId={modeId} size={10} />
                  <span className="text-[10px] text-gray-500">{totalModes[modeId]}</span>
                </div>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-accent-orange rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Stacked bar chart */}
              <div className="flex items-end gap-1" style={{ height: "140px" }}>
                {history.map((week, i) => {
                  const streak = streaks[i];
                  const barHeight = Math.max((week.count / maxCount) * 120, week.count > 0 ? 6 : 4);
                  const isCurrentWeek = i === history.length - 1;

                  // Build stacked segments
                  const segments = MODE_ORDER
                    .filter((m) => (week.modes[m] || 0) > 0)
                    .map((m) => ({
                      mode: m,
                      count: week.modes[m],
                      height: (week.modes[m] / week.count) * barHeight,
                      color: MODE_BAR_COLORS[m],
                    }));

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                      {/* Post count */}
                      <span className={`text-[9px] font-bold mb-1 ${
                        week.uniqueDays >= 5 ? getStreakTextColor(streak) : week.count > 0 ? "text-gray-500" : "text-gray-300"
                      }`}>
                        {week.count > 0 ? week.count : ""}
                      </span>
                      {/* Stacked bar */}
                      <div
                        className={`w-full rounded-t-md overflow-hidden flex flex-col-reverse ${isCurrentWeek ? "ring-1 ring-accent-orange" : ""}`}
                        style={{ height: `${barHeight}px` }}
                      >
                        {week.count === 0 ? (
                          <div className="w-full h-full bg-gray-100 rounded-t-md" />
                        ) : segments.length > 0 ? (
                          segments.map((seg) => (
                            <div
                              key={seg.mode}
                              style={{ height: `${seg.height}px`, backgroundColor: seg.color }}
                            />
                          ))
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                      </div>
                      {/* Streak kept marker */}
                      {week.uniqueDays >= 5 && (
                        <div className="w-1 h-1 rounded-full bg-accent-orange mt-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Week labels */}
              <div className="flex gap-1">
                {history.map((week, i) => (
                  <div key={i} className="flex-1 text-center">
                    <span className={`text-[8px] ${i === history.length - 1 ? "text-accent-orange font-bold" : "text-gray-400"}`}>
                      {formatWeekLabel(week.weekStart)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Streak summary */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Current streak</span>
                <span className={`text-sm font-bold ${getStreakTextColor(streaks[streaks.length - 1] || 0)}`}>
                  {streaks[streaks.length - 1] || 0} week{(streaks[streaks.length - 1] || 0) !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Best streak</span>
                <span className={`text-sm font-bold ${getStreakTextColor(Math.max(...streaks, 0))}`}>
                  {Math.max(...streaks, 0)} week{Math.max(...streaks, 0) !== 1 ? "s" : ""}
                </span>
              </div>
            </>
          )}
        </div>{/* end scrollable */}
      </div>
    </>
  );
}
