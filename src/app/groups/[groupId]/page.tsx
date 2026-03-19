"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  limitToLast,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { calculateLevel } from "@/lib/utils";
import { FOCUS_MODES, MESSAGE_CHAR_LIMIT } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmModal from "@/components/ConfirmModal";
import { FocusModeIcon, IconHeart, IconCamera, IconEdit } from "@/components/icons";
import type { Group } from "@/types";
import { compressImage } from "@/lib/imageUtils";
import { useAsciiInput } from "@/hooks/useAsciiInput";

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
  reactions: Record<string, boolean>;
}

export default function GroupChatPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const { showWarn, sanitize } = useAsciiInput();

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [memberProfiles, setMemberProfiles] = useState<Record<string, any>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [editGoal, setEditGoal] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Fetch group & auto-join official group if not yet a member
  useEffect(() => {
    async function fetchGroup() {
      const snap = await getDoc(doc(db, "groups", groupId));
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Group;

      if (data.isOfficial && user && !data.memberIds.includes(user.uid)) {
        try {
          await updateDoc(doc(db, "groups", groupId), {
            memberIds: arrayUnion(user.uid),
            memberCount: increment(1),
          });
          data.memberIds = [...data.memberIds, user.uid];
          data.memberCount = data.memberCount + 1;
        } catch (err) {
          console.warn("Auto-join official group failed:", err);
        }
      }

      setGroup(data);
      setEditGoal(data.goal || "");
    }
    if (user) fetchGroup().catch((err) => console.error("fetchGroup error:", err));
  }, [groupId, user]);

  // Real-time messages — only subscribe after confirmed as member
  const isMemberNow = group?.memberIds?.includes(user?.uid || "");
  useEffect(() => {
    if (!isMemberNow) return;
    const q = query(
      collection(db, "groups", groupId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    }, (err) => {
      console.warn("Messages listener error:", err);
    });
    return unsub;
  }, [groupId, isMemberNow]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read when viewing messages
  useEffect(() => {
    if (user && isMemberNow && messages.length > 0) {
      setDoc(doc(db, "groups", groupId, "lastRead", user.uid), {
        readAt: serverTimestamp(),
      }).catch(() => {});
    }
  }, [user, groupId, messages.length]);

  useEffect(() => {
    if (!group) return;
    async function fetchMembers() {
      const profiles: Record<string, any> = {};
      // Fetch current members + message senders (may include deleted accounts)
      const senderIds = messages.map((m) => m.senderId);
      const allIds = [...new Set([...group!.memberIds, ...senderIds])];
      for (const uid of allIds) {
        if (profiles[uid]) continue;
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          profiles[uid] = snap.data();
        } else {
          profiles[uid] = { displayName: "Deleted Account", _deleted: true };
        }
      }
      setMemberProfiles(profiles);
    }
    fetchMembers();
  }, [group, messages]);

  const isOfficial = !!group?.isOfficial;
  const isMember = isMemberNow;
  const isLeader = group?.creatorId === user?.uid;
  const isFull = !isOfficial && (group?.memberCount || 0) >= 10;
  const modeInfo = FOCUS_MODES.find((m) => m.id === group?.mode);

  const userLevel = profile ? calculateLevel(profile.totalXP) : 0;

  const handleJoinAttempt = async () => {
    if (!user || !group || isFull || isOfficial) return;
    if (userLevel < 5) {
      alert("You need Lv.5 or higher to join a community.");
      return;
    }
    const currentGroupIds = profile?.groupIds || [];
    if (currentGroupIds.length >= 2) {
      alert("You can join up to 2 communities (+ official). Please leave one first.");
      return;
    }
    await performJoin();
  };

  const performJoin = async () => {
    if (!user || !group) return;
    await updateDoc(doc(db, "groups", groupId), {
      memberIds: arrayUnion(user.uid),
      memberCount: increment(1),
    });
    await updateDoc(doc(db, "users", user.uid), { groupIds: arrayUnion(groupId) });
    setGroup((g) => g ? { ...g, memberIds: [...g.memberIds, user.uid], memberCount: g.memberCount + 1 } : g);
    await refreshProfile();
  };

  const handleLeaveConfirm = async () => {
    if (!user || !group || isOfficial) return;
    setShowLeaveModal(false);
    const newMemberCount = group.memberCount - 1;
    if (isLeader) {
      await updateDoc(doc(db, "groups", groupId), { isClosed: true });
    } else {
      await updateDoc(doc(db, "groups", groupId), {
        memberIds: arrayRemove(user.uid),
        memberCount: increment(-1),
      });
      if (newMemberCount <= 0) {
        await updateDoc(doc(db, "groups", groupId), { isClosed: true });
      }
    }
    await updateDoc(doc(db, "users", user.uid), { groupIds: arrayRemove(groupId) });
    await refreshProfile();
    router.replace("/groups");
  };

  const handleKick = async (uid: string) => {
    if (!isLeader || !group) return;
    if (!confirm("Kick this member?")) return;
    await updateDoc(doc(db, "groups", groupId), {
      memberIds: arrayRemove(uid),
      memberCount: increment(-1),
    });
    // groupIds cleanup for kicked user is handled by syncGroupMembership Cloud Function
    setGroup((g) => g ? {
      ...g,
      memberIds: g.memberIds.filter((id) => id !== uid),
      memberCount: g.memberCount - 1,
    } : g);
  };

  const handleSend = async () => {
    if (!user || !text.trim() || !isMember) return;
    const msg = text.trim();
    setText("");
    await addDoc(collection(db, "groups", groupId, "messages"), {
      senderId: user.uid,
      text: msg,
      createdAt: serverTimestamp(),
      reactions: {},
    });
    await updateDoc(doc(db, "groups", groupId), {
      lastMessageAt: serverTimestamp(),
      lastMessageText: msg.length > 50 ? msg.slice(0, 50) + "…" : msg,
      lastMessageBy: user.uid,
    });
  };

  const handleReaction = async (msgId: string, hasReacted: boolean) => {
    if (!user) return;
    const msgRef = doc(db, "groups", groupId, "messages", msgId);
    await updateDoc(msgRef, { [`reactions.${user.uid}`]: !hasReacted });
  };

  // Leader: change icon
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !group) return;
    const blob = await compressImage(file, { maxSize: 256, maxFileSize: 100 * 1024 });
    const iconRef = ref(storage, `groups/${groupId}/icon.jpg`);
    await uploadBytes(iconRef, blob, { contentType: "image/jpeg" });
    const url = await getDownloadURL(iconRef);
    await updateDoc(doc(db, "groups", groupId), { iconUrl: url });
    setGroup((g) => g ? { ...g, iconUrl: url } : g);
  };

  // Leader: save settings
  const handleSaveSettings = async () => {
    if (!group) return;
    setSavingSettings(true);
    await updateDoc(doc(db, "groups", groupId), {
      goal: editGoal.trim(),
    });
    setGroup((g) => g ? { ...g, goal: editGoal.trim() } : g);
    setSavingSettings(false);
    setShowSettings(false);
  };

  if (!group) {
    return <LoadingSpinner fullScreen />;
  }

  if (group.isClosed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-6">
        <p className="text-white/60">This community has been disbanded</p>
        <button onClick={() => router.push("/groups")} className="mt-4 text-accent-orange">
          Back to Community
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="sticky top-0 bg-forest/95 backdrop-blur-md border-b border-forest-light/20 px-4 py-3 z-10" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/groups")} className="w-10 h-10 flex items-center justify-center text-white/60 text-xl -ml-2">
            ←
          </button>
          {/* Group icon — leader can tap to change */}
          <div className="relative shrink-0">
            {group.iconUrl ? (
              <img src={group.iconUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-forest-light/30 flex items-center justify-center">
                <FocusModeIcon modeId={group.mode || "challenging"} size={22} className="text-white/60" />
              </div>
            )}
            {isLeader && (
              <button
                onClick={() => iconInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent-orange flex items-center justify-center"
              >
                <IconCamera size={11} className="text-white" />
              </button>
            )}
            <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm truncate text-white/90">{group.groupName}</h1>
              {group.isOfficial && (
                <span className="text-[10px] bg-accent-orange text-white px-1.5 py-0.5 rounded-full shrink-0">Official</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              {modeInfo && (
                <span className="flex items-center gap-0.5">
                  <FocusModeIcon modeId={modeInfo.id} size={10} className="text-white/50" />
                  {modeInfo.description}
                </span>
              )}
              <span>· {group.memberCount}{isOfficial ? "" : "/10"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLeader && (
              <button onClick={() => { setEditGoal(group.goal || ""); setShowSettings(true); }} className="w-10 h-10 flex items-center justify-center text-white/50">
                <IconEdit size={20} />
              </button>
            )}
            {isOfficial ? (
              <span className="text-xs bg-accent-orange text-white px-2.5 py-1 rounded-full">Official</span>
            ) : isMember ? (
              <button onClick={() => setShowLeaveModal(true)} className="text-sm text-red-400 px-2 py-1">Leave</button>
            ) : !isFull && userLevel >= 5 ? (
              <button onClick={handleJoinAttempt} className="bg-accent-orange text-white text-sm px-4 py-1.5 rounded-full flex items-center gap-1">
                Join
              </button>
            ) : !isFull && userLevel < 5 ? (
              <span className="text-xs text-white/40">Lv.5+</span>
            ) : null}
          </div>
        </div>

        {/* Goal banner */}
        {group.goal ? (
          <div className="mt-2 bg-forest-light/20 rounded-lg px-3 py-1.5 border border-accent-orange/20">
            <p className="text-[10px] font-bold text-accent-orange mb-0.5">Goal / Rules</p>
            <p className="text-xs text-white/70 leading-snug">{group.goal}</p>
          </div>
        ) : (
          <div className="mt-2 bg-forest-light/10 rounded-lg px-3 py-2 border border-dashed border-white/20">
            {isLeader ? (
              <button
                onClick={() => { setEditGoal(""); setShowSettings(true); }}
                className="w-full text-xs text-white/40 text-center"
              >
                Set community goals & rules →
              </button>
            ) : (
              <p className="text-xs text-white/40 text-center">No community goals or rules set yet</p>
            )}
          </div>
        )}

        {/* Member list */}
        {isMember && (
          <div className="flex gap-3 mt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {group.memberIds.map((uid) => {
              const mp = memberProfiles[uid];
              return (
                <div key={uid} className="flex flex-col items-center min-w-[56px]">
                  <button onClick={() => router.push(uid === user?.uid ? "/mypage" : `/user/${uid}`)} className="flex flex-col items-center">
                    <Avatar photoURL={mp?.photoURL} displayName={mp?.displayName || "?"} uid={uid} size={44} />
                    <span className="text-[10px] text-white/60 truncate max-w-[56px] mt-0.5">
                      {mp?.displayName || "..."}
                    </span>
                  </button>
                  {group.creatorId === uid && (
                    <span className="text-[8px] text-accent-orange">Leader</span>
                  )}
                  {isLeader && uid !== user?.uid && (
                    <button onClick={() => handleKick(uid)} className="text-[8px] text-red-400">kick</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leader settings modal */}
      {showSettings && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowSettings(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center">
            <div className="w-full max-w-[430px] bg-white rounded-t-2xl p-5">
              <h3 className="font-bold text-sm mb-3">Community Settings</h3>
              <label className="block text-xs font-medium text-gray-500 mb-1">Goal / Rules</label>
              <textarea
                value={editGoal}
                onChange={(e) => setEditGoal(sanitize(e.target.value, /[^\x20-\x7E\n]/g))}
                maxLength={200}
                rows={3}
                placeholder="Write your community's goals or rules"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange resize-none"
              />
              <p className="text-[10px] text-gray-300 text-right mb-3">{editGoal.length}/200</p>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full bg-accent-orange text-white font-bold py-2.5 rounded-full disabled:opacity-50"
              >
                {savingSettings ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </>
      )}

      {showLeaveModal && (
        <ConfirmModal
          title="Leave Community"
          message={isLeader
            ? "If the Leader leaves, the community will be disbanded. Are you sure?"
            : "Are you sure you want to leave this community?"}
          confirmLabel="Leave"
          confirmVariant="danger"
          onConfirm={handleLeaveConfirm}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          const sender = memberProfiles[msg.senderId];
          const isDeleted = sender?._deleted;
          const reactionCount = Object.values(msg.reactions || {}).filter(Boolean).length;
          const hasReacted = msg.reactions?.[user?.uid || ""] === true;
          const time = msg.createdAt?.toDate?.();
          const timeStr = time
            ? `${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`
            : "";

          if (isMe) {
            return (
              <div key={msg.id} className="flex justify-end items-end gap-1.5">
                <div className="flex flex-col items-end">
                  <div className="bg-accent-orange text-white px-3 py-2 rounded-2xl rounded-br-md text-sm max-w-[65vw]">
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button onClick={() => handleReaction(msg.id, hasReacted)} className="text-xs">
                      <span className={`inline-flex items-center gap-0.5 ${hasReacted ? "text-red-500" : "text-white/30"}`}>
                        <IconHeart size={12} filled={hasReacted} />{reactionCount > 0 && <span>{reactionCount}</span>}
                      </span>
                    </button>
                    {timeStr && <span className="text-[10px] text-white/30">{timeStr}</span>}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2">
              {/* Avatar */}
              {isDeleted ? (
                <div className="w-8 h-8 rounded-full bg-forest-light/20 flex items-center justify-center shrink-0">
                  <span className="text-white/40 text-xs">?</span>
                </div>
              ) : (
                <button onClick={() => router.push(`/user/${msg.senderId}`)} className="shrink-0">
                  <Avatar photoURL={sender?.photoURL} displayName={sender?.displayName || "?"} uid={msg.senderId} size={32} />
                </button>
              )}
              {/* Name + Bubble + Time */}
              <div className="flex flex-col min-w-0">
                {isDeleted ? (
                  <span className="text-[10px] text-white/30 mb-0.5 italic">Deleted Account</span>
                ) : (
                  <button onClick={() => router.push(`/user/${msg.senderId}`)} className="text-[10px] text-white/60 font-medium mb-0.5 text-left active:text-accent-orange truncate max-w-[50vw]">
                    {sender?.displayName || "..."}
                  </button>
                )}
                <div className="bg-forest-light/20 text-white/90 px-3 py-2 rounded-2xl rounded-bl-md text-sm max-w-[65vw] w-fit">
                  {msg.text}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <button onClick={() => handleReaction(msg.id, hasReacted)} className="text-xs">
                    <span className={`inline-flex items-center gap-0.5 ${hasReacted ? "text-red-500" : "text-white/30"}`}>
                      <IconHeart size={12} filled={hasReacted} />{reactionCount > 0 && <span>{reactionCount}</span>}
                    </span>
                  </button>
                  {timeStr && <span className="text-[10px] text-white/30">{timeStr}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isMember && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3">
          {showWarn && <p className="text-red-400 text-xs font-bold mb-1 ml-1">English characters only</p>}
          <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(sanitize(e.target.value).slice(0, MESSAGE_CHAR_LIMIT))}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={`Message (${MESSAGE_CHAR_LIMIT} chars max)`}
            maxLength={MESSAGE_CHAR_LIMIT}
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="bg-accent-orange text-white rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            Send
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
