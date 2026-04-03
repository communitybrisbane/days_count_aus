"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { FOCUS_MODES, POST_CONTENT_MAX, HASHTAG_SUGGESTIONS, HASHTAG_MAX, REGIONS, resolveMode } from "@/lib/constants";
import { FocusModeIcon, IconGlobe, IconLock } from "@/components/icons";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";

export default function EditPostPage() {
  const { postId } = useParams();
  const { user, profile } = useAuth();
  const router = useRouter();
  const { showWarn, sanitize } = useAsciiInput();

  const [content, setContent] = useState("");
  const [mode, setMode] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [postRegion, setPostRegion] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [dayNumber, setDayNumber] = useState(0);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [openSection, setOpenSection] = useState<"" | "mode" | "tags" | "visibility">("");
  const tagsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchPost() {
      const snap = await getDoc(doc(db, "posts", postId as string));
      if (!snap.exists()) {
        router.replace("/mypage");
        return;
      }
      const data = snap.data();
      if (data.userId !== user?.uid) {
        router.replace("/mypage");
        return;
      }
      setContent(data.content || "");
      setMode(resolveMode(data.mode || ""));
      setTags(data.tags || []);
      setPostRegion(data.region || "");
      setVisibility(data.visibility || "public");
      setDayNumber(data.dayNumber || 0);
      setLoaded(true);
    }
    if (user) fetchPost();
  }, [user, postId, router]);

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < HASHTAG_MAX ? [...prev, tag] : prev
    );
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!t || tags.length >= HASHTAG_MAX) return;
    const formatted = `#${t}`;
    if (!tags.includes(formatted)) setTags((prev) => [...prev, formatted]);
    setCustomTag("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "posts", postId as string), {
        content: content.trim(),
        mode,
        tags,
        region: postRegion,
        visibility,
        dayNumber,
      });
      router.back();
    } catch (e) {
      console.error("Failed to save post edit:", e);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  const modeInfo = FOCUS_MODES.find((m) => m.id === mode);

  return (
    <div className="min-h-dvh flex flex-col" style={{ paddingTop: "max(0rem, env(safe-area-inset-top, 0px))", paddingBottom: "max(0rem, env(safe-area-inset-bottom, 0px))" }}>
      {/* Region picker modal */}
      {showRegionPicker && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowRegionPicker(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[50dvh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm">Select Region</h3>
              <button onClick={() => setShowRegionPicker(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center" aria-label="Close">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2" style={{ scrollbarWidth: "none" }}>
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => { setPostRegion(r); setShowRegionPicker(false); }}
                  className={`py-2 px-2 rounded-xl text-xs font-medium text-center transition-all active:scale-[0.97] ${
                    postRegion === r ? "bg-accent-orange text-white" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Day picker modal */}
      {showDayPicker && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowDayPicker(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm">Select Date</h3>
              <button onClick={() => setShowDayPicker(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center" aria-label="Close">&times;</button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
              />
              {dateInput && (
                <p className="text-center text-sm text-gray-500">
                  {(() => {
                    const dep = profile?.departureDate;
                    if (!dep) return `D+0`;
                    const depDate = new Date(dep + "T00:00:00");
                    const selected = new Date(dateInput + "T00:00:00");
                    const diff = Math.floor((selected.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (diff >= 0) return `D+${diff + 1}`;
                    return `D${diff}`;
                  })()}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDayPicker(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const dep = profile?.departureDate;
                    if (!dep || !dateInput) { setShowDayPicker(false); return; }
                    const depDate = new Date(dep + "T00:00:00");
                    const selected = new Date(dateInput + "T00:00:00");
                    const diff = Math.floor((selected.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));
                    setDayNumber(diff >= 0 ? diff + 1 : diff);
                    setShowDayPicker(false);
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-accent-orange rounded-xl"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-2 py-2 bg-forest/95 backdrop-blur-md border-b border-forest-light/20" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}>
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center text-white/70 active:text-white" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4L7 10L13 16" /></svg>
        </button>
        <h1 className="text-sm font-bold text-white/90">Edit Post</h1>
        <button onClick={handleSave} disabled={saving || !mode} className="px-5 py-2 rounded-full bg-accent-orange text-white text-sm font-bold disabled:opacity-40 active:scale-[0.96] transition-transform">
          {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : "Save"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Meta row */}
        <div className="flex items-center gap-2 px-4 pt-3">
          <button
            onClick={() => setShowRegionPicker(true)}
            className="text-[10px] bg-forest-mid/10 text-forest-mid px-2 py-0.5 rounded-full font-medium border border-forest-mid/20 active:bg-forest-mid/20"
          >
            {postRegion || "Select region"}
          </button>
          <button
            onClick={() => { setDateInput(new Date().toISOString().slice(0, 10)); setShowDayPicker(true); }}
            className="text-xs bg-gray-100/10 px-2 py-0.5 rounded-full text-white/50 border border-white/20 active:bg-white/10"
          >
            {dayNumber > 0 ? `D+${dayNumber}` : `D${dayNumber}`}
          </button>
        </div>

        {/* Content input */}
        <div className="px-4 mt-3">
          <textarea
            value={content}
            onChange={(e) => setContent(sanitize(e.target.value, /[^\x20-\x7E\n\u{1F300}-\u{1FAF8}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu))}
            maxLength={POST_CONTENT_MAX}
            rows={4}
            placeholder="What happened today? (English only)"
            className="w-full border border-forest-light/30 bg-forest-light/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange resize-none placeholder-white/30"
          />
          <div className="flex items-center justify-between">
            <AsciiWarn show={showWarn} />
            <p className="text-[10px] text-white/30 ml-auto">{content.length}/{POST_CONTENT_MAX}</p>
          </div>
        </div>

        {/* Accordion sections */}
        <div className="px-4 mt-3 space-y-1.5">

          {/* Mode */}
          <button
            onClick={() => setOpenSection(openSection === "mode" ? "" : "mode")}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-forest-light/10 active:bg-forest-light/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              {modeInfo && <FocusModeIcon modeId={modeInfo.id} size={14} className="text-accent-orange" />}
              <span className="text-xs font-bold text-white/70">Mode</span>
              {modeInfo && <span className="text-xs text-accent-orange font-medium">{modeInfo.label}</span>}
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-white/30 transition-transform ${openSection === "mode" ? "rotate-180" : ""}`}><path d="M3 4.5L6 7.5L9 4.5" /></svg>
          </button>
          {openSection === "mode" && (
            <div className="px-1 pb-1">
              {[["english", "skill", "challenge"], ["work", "chill"]].map((row, ri) => (
                <div key={ri} className={`flex gap-1.5 ${ri === 0 ? "mb-1.5" : ""}`}>
                  {FOCUS_MODES.filter((m) => row.includes(m.id)).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setMode(m.id); setOpenSection(""); }}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-full transition-all active:scale-[0.97] text-xs font-medium ${
                        mode === m.id ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                      }`}
                    >
                      <FocusModeIcon modeId={m.id} size={14} />
                      {m.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          <button
            onClick={() => setOpenSection(openSection === "tags" ? "" : "tags")}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-forest-light/10 active:bg-forest-light/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/70">Tags</span>
              {tags.length > 0 && <span className="text-xs text-accent-orange font-medium">{tags.length}/{HASHTAG_MAX}</span>}
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-white/30 transition-transform ${openSection === "tags" ? "rotate-180" : ""}`}><path d="M3 4.5L6 7.5L9 4.5" /></svg>
          </button>
          {openSection === "tags" && (
            <div className="px-1 pb-1" ref={tagsRef}>
              <div className="flex flex-wrap gap-1.5">
                {[...(HASHTAG_SUGGESTIONS[mode] || []), ...tags.filter((t) => !(HASHTAG_SUGGESTIONS[mode] || []).includes(t))].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-all active:scale-[0.97] ${
                      tags.includes(tag) ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 mt-2">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
                  placeholder="Custom tag"
                  maxLength={20}
                  className="flex-1 border border-forest-light/30 bg-forest-light/10 text-white rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-orange placeholder-white/30"
                />
                <button
                  onClick={addCustomTag}
                  disabled={!customTag.trim() || tags.length >= HASHTAG_MAX}
                  className="px-3 py-1.5 bg-white text-forest-mid rounded-full text-xs font-bold disabled:opacity-30"
                >
                  + Add
                </button>
              </div>
            </div>
          )}

          {/* Visibility */}
          <button
            onClick={() => setOpenSection(openSection === "visibility" ? "" : "visibility")}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-forest-light/10 active:bg-forest-light/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              {visibility === "public" ? <IconGlobe size={14} className="text-white/50" /> : <IconLock size={14} className="text-white/50" />}
              <span className="text-xs font-bold text-white/70">Visibility</span>
              <span className="text-xs text-accent-orange font-medium">{visibility === "public" ? "Public" : "Private"}</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-white/30 transition-transform ${openSection === "visibility" ? "rotate-180" : ""}`}><path d="M3 4.5L6 7.5L9 4.5" /></svg>
          </button>
          {openSection === "visibility" && (
            <div className="flex gap-1.5 px-1 pb-1">
              <button
                onClick={() => { setVisibility("public"); setOpenSection(""); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all active:scale-[0.98] ${
                  visibility === "public" ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                }`}
              >
                <IconGlobe size={14} />
                <span className="text-xs font-bold">Public</span>
              </button>
              <button
                onClick={() => { setVisibility("private"); setOpenSection(""); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all active:scale-[0.98] ${
                  visibility === "private" ? "bg-accent-orange text-white" : "bg-white text-forest-mid"
                }`}
              >
                <IconLock size={14} />
                <span className="text-xs font-bold">Private</span>
              </button>
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}
