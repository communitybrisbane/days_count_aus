"use client";

import { useEffect, useRef, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { FOCUS_MODES, GRADIENTS, resolveMode } from "@/lib/constants";
import { FocusModeIcon, IconLock } from "@/components/icons";
import ConfirmModal from "@/components/ConfirmModal";
import type { Meeting } from "@/types";

const manageMeeting = httpsCallable(functions, "manageMeeting");

function modeGradient(mode: string): string {
  const idx = FOCUS_MODES.findIndex((m) => m.id === resolveMode(mode));
  return GRADIENTS[idx >= 0 ? idx : 0];
}

export default function MeetingBoard({ currentUid }: { currentUid?: string }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showHostModal, setShowHostModal] = useState(false);
  const [friendsConfirm, setFriendsConfirm] = useState<Meeting | null>(null);
  const [endTarget, setEndTarget] = useState<Meeting | null>(null);

  // Host form
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("english");
  const [url, setUrl] = useState("");
  const [joinType, setJoinType] = useState<"open" | "friends">("open");
  const [durationHours, setDurationHours] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  // Re-evaluate expiry every minute so cards disappear on time
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Live meetings feed
  useEffect(() => {
    // Sort client-side to avoid needing a composite index
    const q = query(collection(db, "meetings"), where("active", "==", true));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting));
      list.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      setMeetings(list);
    }, (err) => console.warn("Meetings listener error:", err));
  }, []);

  // Hide expired meetings — the display window is set by the host; the actual
  // call ends whenever the host ends it on the external service
  const liveMeetings = meetings.filter((m) => !m.expiresAt || m.expiresAt.toMillis() > now);

  // Auto-scroll carousel when multiple meetings are live
  const scrollRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);
  useEffect(() => {
    if (liveMeetings.length < 2) return;
    const timer = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      idxRef.current = (idxRef.current + 1) % liveMeetings.length;
      el.scrollTo({ left: idxRef.current * el.clientWidth, behavior: "smooth" });
    }, 4000);
    return () => clearInterval(timer);
  }, [liveMeetings.length]);

  const openMeeting = (m: Meeting) => {
    window.open(m.url, "_blank", "noopener,noreferrer");
  };

  const handleHost = async () => {
    if (submitting) return;
    if (!url.startsWith("https://")) {
      alert("Meeting link must start with https://");
      return;
    }
    setSubmitting(true);
    try {
      await manageMeeting({ action: "create", password, title, mode, url, joinType, durationHours });
      setShowHostModal(false);
      setTitle(""); setUrl(""); setPassword(""); setJoinType("open");
    } catch (e) {
      alert((e as Error).message || "Failed to start meeting");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnd = async () => {
    if (!endTarget || submitting) return;
    setSubmitting(true);
    try {
      await manageMeeting({ action: "end", password, meetingId: endTarget.id });
      setEndTarget(null);
      setPassword("");
    } catch (e) {
      alert((e as Error).message || "Failed to end meeting");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 pt-2">
      {/* Section header with host entry point */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs font-bold text-white/50">Live Meetings</p>
        <button
          onClick={() => setShowHostModal(true)}
          className="text-[10px] font-bold text-white/40 border border-white/15 px-2 py-0.5 rounded-full active:text-white/70"
        >
          + Host
        </button>
      </div>

      {liveMeetings.length === 0 ? (
        /* Offline placeholder */
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl shrink-0 overflow-hidden opacity-40">
              <img src="/icons/icon-192x192.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white/40">No live meeting</p>
              <p className="text-xs text-white/25 mt-0.5">Check back later</p>
            </div>
            <span className="text-xs font-bold text-white/20 px-3 py-1.5 rounded-full border border-white/10 shrink-0">
              Offline
            </span>
          </div>
        </div>
      ) : (
        /* Auto-scrolling carousel of live meetings */
        <div ref={scrollRef} className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-2xl">
          {liveMeetings.map((m) => (
            <div key={m.id} className="w-full shrink-0 snap-center">
              <div
                onClick={() => (m.joinType === "friends" ? setFriendsConfirm(m) : openMeeting(m))}
                className={`bg-gradient-to-br ${modeGradient(m.mode)} rounded-2xl p-4 shadow-lg cursor-pointer active:scale-[0.98] transition-transform`}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl shrink-0 bg-white/20 flex items-center justify-center overflow-hidden">
                    {m.hostPhotoURL ? (
                      <img src={m.hostPhotoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FocusModeIcon modeId={resolveMode(m.mode)} size={26} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-white truncate">{m.title}</p>
                      {m.joinType === "friends" && <IconLock size={13} className="text-white/80 shrink-0" />}
                      <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-green-500 px-2 py-0.5 rounded-full animate-pulse shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        LIVE
                      </span>
                    </div>
                    <p className="text-xs text-white/70 mt-0.5 truncate">
                      Hosted by {m.hostName}
                      {m.expiresAt && (
                        <span className="text-white/50"> · until {new Date(m.expiresAt.toMillis()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    {m.hostUid === currentUid && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEndTarget(m); }}
                        className="text-[10px] font-bold text-white/70 border border-white/30 px-2 py-0.5 rounded-full active:bg-white/10"
                      >
                        End
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dots for carousel */}
      {liveMeetings.length > 1 && (
        <div className="flex justify-center gap-1 mt-1.5">
          {liveMeetings.map((m, i) => (
            <span key={m.id} className="w-1 h-1 rounded-full bg-white/25" aria-hidden="true" data-idx={i} />
          ))}
        </div>
      )}

      {/* Friends-only confirmation */}
      {friendsConfirm && (
        <ConfirmModal
          title="Friends Only Meeting"
          message="This meeting is for people who know each other. Only join if you know the host."
          confirmLabel="Join"
          onConfirm={() => { openMeeting(friendsConfirm); setFriendsConfirm(null); }}
          onCancel={() => setFriendsConfirm(null)}
        />
      )}

      {/* End meeting modal */}
      {endTarget && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => { setEndTarget(null); setPassword(""); }} aria-hidden="true" />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl p-5 max-w-sm mx-auto">
            <h3 className="font-bold text-sm text-forest mb-1">End this meeting?</h3>
            <p className="text-xs text-gray-500 mb-3">&ldquo;{endTarget.title}&rdquo; will go offline for everyone.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Staff password"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => { setEndTarget(null); setPassword(""); }} className="flex-1 py-2.5 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl">
                Cancel
              </button>
              <button onClick={handleEnd} disabled={!password || submitting} className="flex-1 py-2.5 text-xs font-bold text-white bg-red-500 rounded-xl disabled:opacity-40">
                {submitting ? "..." : "End Meeting"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Host meeting modal */}
      {showHostModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setShowHostModal(false)} aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-2xl max-h-[85dvh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm">Host a Meeting</h3>
              <button onClick={() => setShowHostModal(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center" aria-label="Close">&times;</button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto" style={{ scrollbarWidth: "none", paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">Staff password</p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">Title</p>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={30}
                  placeholder="e.g. Morning study session"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">Mode</p>
                <div className="flex gap-1.5">
                  {FOCUS_MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-full text-xs font-medium transition-all ${
                        mode === m.id ? "bg-accent-orange text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <FocusModeIcon modeId={m.id} size={13} />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">Meeting link</p>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
                />
                {url && !url.startsWith("https://") && (
                  <p className="text-[10px] text-red-400 mt-1">Link must start with https://</p>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">Who can join</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setJoinType("open")}
                    className={`flex-1 py-2 rounded-full text-xs font-medium transition-all ${
                      joinType === "open" ? "bg-accent-orange text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    Anyone
                  </button>
                  <button
                    onClick={() => setJoinType("friends")}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-full text-xs font-medium transition-all ${
                      joinType === "friends" ? "bg-accent-orange text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <IconLock size={12} />
                    Friends only
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1">Show for</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 6, 12].map((h) => (
                    <button
                      key={h}
                      onClick={() => setDurationHours(h)}
                      className={`flex-1 py-2 rounded-full text-xs font-medium transition-all ${
                        durationHours === h ? "bg-accent-orange text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">The card disappears after this. Ending the actual call is up to you.</p>
              </div>
              <p className="text-[10px] text-gray-400">Hosted as your account name.</p>
              <button
                onClick={handleHost}
                disabled={!password || !title.trim() || !url || submitting}
                className="w-full py-3 text-sm font-bold text-white bg-accent-orange rounded-full disabled:opacity-40"
              >
                {submitting ? "Starting..." : "Go Live"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
