"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { FOCUS_MODES, POST_CONTENT_MAX } from "@/lib/constants";
import AsciiWarn from "@/components/AsciiWarn";
import { useAsciiInput } from "@/hooks/useAsciiInput";

export default function EditPostPage() {
  const { postId } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const { showWarn, sanitize } = useAsciiInput();

  const [content, setContent] = useState("");
  const [mode, setMode] = useState("");
  const [saving, setSaving] = useState(false);
  const [expired, setExpired] = useState(false);

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
      if (data.editableUntil && new Date() >= data.editableUntil.toDate()) {
        setExpired(true);
        return;
      }
      setContent(data.content || data.contentFun || data.contentGrowth || "");
      setMode(data.mode || "");
    }
    if (user) fetchPost();
  }, [user, postId, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "posts", postId as string), {
        content: content.trim(),
        mode,
      });
      router.back();
    } catch (e) {
      console.error("Failed to save post edit:", e);
    } finally {
      setSaving(false);
    }
  };

  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-6">
        <p className="text-gray-500">Edit window (5 min) has expired</p>
        <button onClick={() => router.back()} className="mt-4 text-ocean-blue">Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh p-6">
      <AsciiWarn show={showWarn} />
      <h1 className="text-2xl font-bold mb-6">Edit Post</h1>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Focus Mode</label>
          <div className="flex gap-2">
            {FOCUS_MODES.map((m) => {
              const isWH = m.id === "enjoying" || m.id === "challenging";
              return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 flex flex-col items-center p-2 rounded-xl border-2 ${
                  mode === m.id
                    ? isWH ? "border-aussie-gold bg-amber-50" : "border-ocean-blue bg-blue-50"
                    : isWH ? "border-aussie-gold/20 bg-amber-50/30" : "border-ocean-blue/20 bg-blue-50/30"
                }`}
              >
                <span className="text-xl">{m.icon}</span>
              </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(sanitize(e.target.value, /[^\x20-\x7E\n]/g))}
            maxLength={POST_CONTENT_MAX}
            rows={6}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mt-1 resize-none focus:outline-none focus:ring-2 focus:ring-aussie-gold"
          />
          <p className="text-[10px] text-gray-300 text-right mt-1">{content.length}/{POST_CONTENT_MAX}</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-aussie-gold text-white font-bold py-3 rounded-full disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
