"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
        <p className="text-white/60">Edit window (5 min) has expired</p>
        <button onClick={() => router.back()} className="mt-4 text-accent-orange">Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh p-6">
      <h1 className="text-2xl font-bold mb-6 text-white/90">Edit Post</h1>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-white/80 mb-2 block">Focus Mode</label>
          <div className="flex gap-2">
            {FOCUS_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 flex flex-col items-center p-2 rounded-xl ${
                  mode === m.id
                    ? "bg-accent-orange text-white"
                    : "bg-white text-forest-mid"
                }`}
              >
                <span className="text-xl">{m.icon}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-white/80">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(sanitize(e.target.value, /[^\x20-\x7E\n]/g))}
            maxLength={POST_CONTENT_MAX}
            rows={6}
            className="w-full border border-forest-light/30 bg-forest-light/10 text-white rounded-xl px-4 py-3 mt-1 resize-none focus:outline-none focus:ring-2 focus:ring-accent-orange placeholder-white/30"
          />
          <AsciiWarn show={showWarn} />
          <p className="text-[10px] text-white/30 text-right mt-1">{content.length}/{POST_CONTENT_MAX}</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-accent-orange text-white font-bold py-3 rounded-full disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
