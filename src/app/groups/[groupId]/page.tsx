"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  orderBy,
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
import { FOCUS_MODES } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmModal from "@/components/ConfirmModal";
import { FocusModeIcon, IconHeart, IconCamera, IconEdit, IconLock } from "@/components/icons";
import type { Group } from "@/types";

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

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [memberProfiles, setMemberProfiles] = useState<Record<string, any>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [editGoal, setEditGoal] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Fetch group & auto-join official group if not yet a member
  useEffect(() => {
    async function fetchGroup() {
      const snap = await getDoc(doc(db, "groups", groupId));
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Group;

      if (data.isOfficial && user && !data.memberIds.includes(user.uid)) {
        await updateDoc(doc(db, "groups", groupId), {
          memberIds: arrayUnion(user.uid),
          memberCount: increment(1),
        });
        data.memberIds = [...data.memberIds, user.uid];
        data.memberCount = data.memberCount + 1;
      }

      setGroup(data);
      setEditGoal(data.goal || "");
      setEditPassword(data.password || "");
    }
    if (user) fetchGroup();
  }, [groupId, user]);

  // Real-time messages
  useEffect(() => {
    const q = query(
      collection(db, "groups", groupId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
    return unsub;
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!group) return;
    async function fetchMembers() {
      const profiles: Record<string, any> = {};
      for (const uid of group!.memberIds) {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) profiles[uid] = snap.data();
      }
      setMemberProfiles(profiles);
    }
    fetchMembers();
  }, [group]);

  const isOfficial = !!group?.isOfficial;
  const isMember = group?.memberIds?.includes(user?.uid || "");
  const isLeader = group?.creatorId === user?.uid;
  const isFull = !isOfficial && (group?.memberCount || 0) >= 10;
  const modeInfo = FOCUS_MODES.find((m) => m.id === group?.mode);

  const handleJoinAttempt = () => {
    if (!user || !group || isFull || isOfficial) return;
    const currentGroupIds = profile?.groupIds || [];
    if (currentGroupIds.length >= 2) {
      alert("You can join up to 2 communities (+ official). Please leave one first.");
      return;
    }
    if (group.password) {
      setPasswordInput("");
      setPasswordError("");
      setShowPasswordModal(true);
    } else {
      performJoin();
    }
  };

  const performJoin = async () => {
    if (!user || !group) return;
    await updateDoc(doc(db, "groups", groupId), {
      memberIds: arrayUnion(user.uid),
      memberCount: increment(1),
    });
    await updateDoc(doc(db, "users", user.uid), { groupIds: arrayUnion(groupId) });
    setGroup((g) => g ? { ...g, memberIds: [...g.memberIds, user.uid], memberCount: g.memberCount + 1 } : g);
    setShowPasswordModal(false);
    await refreshProfile();
  };

  const handlePasswordSubmit = () => {
    if (!group) return;
    if (passwordInput.trim() === group.password) {
      performJoin();
    } else {
      setPasswordError("Wrong password");
    }
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
    await updateDoc(doc(db, "users", uid), { groupIds: arrayRemove(groupId) });
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
    await updateDoc(doc(db, "groups", groupId), { lastMessageAt: serverTimestamp() });
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
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 256, 256);
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const iconRef = ref(storage, `groups/${groupId}/icon.jpg`);
          await uploadBytes(iconRef, blob);
          const url = await getDownloadURL(iconRef);
          await updateDoc(doc(db, "groups", groupId), { iconUrl: url });
          setGroup((g) => g ? { ...g, iconUrl: url } : g);
        }, "image/jpeg", 0.85);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Leader: save settings
  const handleSaveSettings = async () => {
    if (!group) return;
    setSavingSettings(true);
    await updateDoc(doc(db, "groups", groupId), {
      goal: editGoal.trim(),
      password: editPassword.trim(),
    });
    setGroup((g) => g ? { ...g, goal: editGoal.trim(), password: editPassword.trim() } : g);
    setSavingSettings(false);
    setShowSettings(false);
  };

  if (!group) {
    return <LoadingSpinner fullScreen />;
  }

  if (group.isClosed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-6">
        <p className="text-gray-500">This community has been disbanded</p>
        <button onClick={() => router.push("/groups")} className="mt-4 text-ocean-blue">
          Back to Community
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 p-4 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/groups")} className="text-gray-400">
            ←
          </button>
          {/* Group icon — leader can tap to change */}
          <div className="relative shrink-0">
            {group.iconUrl ? (
              <img src={group.iconUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <FocusModeIcon modeId={group.mode || "challenging"} size={20} className="text-gray-500" />
              </div>
            )}
            {isLeader && (
              <button
                onClick={() => iconInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-aussie-gold flex items-center justify-center"
              >
                <IconCamera size={9} className="text-white" />
              </button>
            )}
            <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm truncate">{group.groupName}</h1>
              {group.password && <IconLock size={12} className="text-gray-400 shrink-0" />}
              {group.isOfficial && (
                <span className="text-[10px] bg-aussie-gold text-white px-1.5 py-0.5 rounded-full shrink-0">Official</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              {modeInfo && (
                <span className="flex items-center gap-0.5">
                  <FocusModeIcon modeId={modeInfo.id} size={10} className="text-gray-400" />
                  {modeInfo.description}
                </span>
              )}
              <span>· {group.memberCount}{isOfficial ? "" : "/10"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLeader && (
              <button onClick={() => { setEditGoal(group.goal || ""); setEditPassword(group.password || ""); setShowSettings(true); }} className="text-gray-400">
                <IconEdit size={18} />
              </button>
            )}
            {isOfficial ? (
              <span className="text-[10px] bg-aussie-gold text-white px-2 py-1 rounded-full">Official</span>
            ) : isMember ? (
              <button onClick={() => setShowLeaveModal(true)} className="text-xs text-red-400">Leave</button>
            ) : !isFull && (
              <button onClick={handleJoinAttempt} className="bg-aussie-gold text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                {group.password && <IconLock size={10} className="text-white" />}Join
              </button>
            )}
          </div>
        </div>

        {/* Goal banner */}
        {group.goal ? (
          <div className="mt-2 bg-amber-50 rounded-lg px-3 py-1.5 border border-aussie-gold/20">
            <p className="text-[10px] font-bold text-aussie-gold mb-0.5">Goal / Rules</p>
            <p className="text-xs text-gray-600 leading-snug">{group.goal}</p>
          </div>
        ) : (
          <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 border border-dashed border-gray-300">
            {isLeader ? (
              <button
                onClick={() => { setEditGoal(""); setEditPassword(group.password || ""); setShowSettings(true); }}
                className="w-full text-xs text-gray-400 text-center"
              >
                Set community goals & rules →
              </button>
            ) : (
              <p className="text-xs text-gray-400 text-center">No community goals or rules set yet</p>
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
                    <span className="text-[10px] text-gray-500 truncate max-w-[56px] mt-0.5">
                      {mp?.displayName || "..."}
                    </span>
                  </button>
                  {group.creatorId === uid && (
                    <span className="text-[8px] text-aussie-gold">Leader</span>
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
                onChange={(e) => setEditGoal(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="Write your community's goals or rules"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold resize-none"
              />
              <p className="text-[10px] text-gray-300 text-right mb-3">{editGoal.length}/200</p>
              <label className="block text-xs font-medium text-gray-500 mb-1">Password <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                maxLength={20}
                placeholder="Leave empty for open community"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold mb-3"
              />
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full bg-aussie-gold text-white font-bold py-2.5 rounded-full disabled:opacity-50"
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

      {/* Password modal */}
      {showPasswordModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowPasswordModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl p-6 z-50 max-w-sm mx-auto">
            <div className="flex items-center justify-center mb-2">
              <IconLock size={24} className="text-aussie-gold" />
            </div>
            <p className="text-center font-bold mb-1">Private Group</p>
            <p className="text-center text-sm text-gray-500 mb-4">Enter the password to join</p>
            <input
              type="text"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(""); }}
              placeholder="Password"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-aussie-gold ${passwordError ? "border-red-400" : "border-gray-200"}`}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              autoFocus
            />
            {passwordError && <p className="text-xs text-red-400 text-center mt-1">{passwordError}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-full text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={!passwordInput.trim()}
                className="flex-1 bg-aussie-gold text-white py-2.5 rounded-full text-sm font-bold disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          const sender = memberProfiles[msg.senderId];
          const reactionCount = Object.values(msg.reactions || {}).filter(Boolean).length;
          const hasReacted = msg.reactions?.[user?.uid || ""] === true;

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <button onClick={() => router.push(`/user/${msg.senderId}`)} className="text-[10px] text-gray-400 mb-0.5 active:text-ocean-blue">{sender?.displayName || "..."}</button>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm ${
                    isMe ? "bg-aussie-gold text-white" : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.text}
                </div>
                <button onClick={() => handleReaction(msg.id, hasReacted)} className="text-xs mt-0.5">
                  <span className={`inline-flex items-center gap-0.5 ${hasReacted ? "text-red-500" : "text-gray-400"}`}>
                    <IconHeart size={14} filled={hasReacted} /> {reactionCount > 0 && reactionCount}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isMember && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 100))}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Message (100 chars max)"
            maxLength={100}
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aussie-gold"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="bg-aussie-gold text-white rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
