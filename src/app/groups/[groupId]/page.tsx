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
import { FOCUS_MODES, MESSAGE_CHAR_LIMIT, resolveMode } from "@/lib/constants";
import Avatar from "@/components/Avatar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmModal from "@/components/ConfirmModal";
import { FocusModeIcon, IconKangaroo, IconCamera, IconEdit } from "@/components/icons";
import type { Group } from "@/types";
import { compressImage } from "@/lib/imageUtils";
import { useAsciiInput } from "@/hooks/useAsciiInput";

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
  reactions: Record<string, boolean>;
  edited?: boolean;
  unsent?: boolean;
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
  const [editJoinType, setEditJoinType] = useState<"open" | "friends">("open");
  const [savingSettings, setSavingSettings] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Fetch group & auto-join official group if not yet a member
  useEffect(() => {
    async function fetchGroup() {
      const snap = await getDoc(doc(db, "groups", groupId));
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Group;

      if (data.isOfficial && !data.iconUrl && user && !data.memberIds.includes(user.uid)) {
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
      setEditJoinType(data.joinType || "open");
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
  const isModeGroup = isOfficial && !group?.iconUrl;
  const isMember = isMemberNow;
  const isLeader = group?.creatorId === user?.uid;
  const isFull = !isOfficial && (group?.memberCount || 0) >= 10;
  const modeInfo = FOCUS_MODES.find((m) => m.id === resolveMode(group?.mode || ""));

  const userLevel = profile ? calculateLevel(profile.totalXP) : 0;

  const handleJoinAttempt = async () => {
    if (!user || !group || isFull) return;
    if (userLevel < 5) {
      alert("You need Lv.5 or higher to join a community.");
      return;
    }
    // Group limit: max 2 groups excluding mode group (mode group + 2 = 3 total in groupIds)
    if (!isModeGroup) {
      const myGroupIds = profile?.groupIds || [];
      if (myGroupIds.length >= 3) {
        alert("Max 2 groups. Please leave one first.");
        return;
      }
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

  const [showLeaderExitModal, setShowLeaderExitModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  const handleLeaveConfirm = async () => {
    if (!user || !group) return;
    setShowLeaveModal(false);
    if (isLeader) {
      // Leader: show transfer/disband choice
      const otherMembers = group.memberIds.filter((id) => id !== user.uid);
      if (otherMembers.length === 0) {
        // No other members — just close
        await updateDoc(doc(db, "groups", groupId), { isClosed: true });
        await updateDoc(doc(db, "users", user.uid), { groupIds: arrayRemove(groupId) });
        await refreshProfile();
        router.replace("/groups");
      } else {
        setShowLeaderExitModal(true);
      }
      return;
    }
    // Non-leader leave
    await updateDoc(doc(db, "groups", groupId), {
      memberIds: arrayRemove(user.uid),
      memberCount: increment(-1),
    });
    await updateDoc(doc(db, "users", user.uid), { groupIds: arrayRemove(groupId) });
    await refreshProfile();
    router.replace("/groups");
  };

  const handleTransferAndLeave = async () => {
    if (!user || !group || !transferTarget) return;
    await updateDoc(doc(db, "groups", groupId), {
      creatorId: transferTarget,
      memberIds: arrayRemove(user.uid),
      memberCount: increment(-1),
    });
    await updateDoc(doc(db, "users", user.uid), { groupIds: arrayRemove(groupId) });
    await refreshProfile();
    setShowLeaderExitModal(false);
    router.replace("/groups");
  };

  const handleDisbandGroup = async () => {
    if (!user || !group) return;
    if (!confirm("This will permanently close the group for everyone. Are you sure?")) return;
    await updateDoc(doc(db, "groups", groupId), { isClosed: true });
    await updateDoc(doc(db, "users", user.uid), { groupIds: arrayRemove(groupId) });
    await refreshProfile();
    setShowLeaderExitModal(false);
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

  // Edit / Unsend state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [actionMenuMsgId, setActionMenuMsgId] = useState<string | null>(null);

  const handleUnsend = async (msgId: string) => {
    if (!user) return;
    const msgRef = doc(db, "groups", groupId, "messages", msgId);
    await updateDoc(msgRef, { text: "", unsent: true });
    setActionMenuMsgId(null);
  };

  const handleEditStart = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditText(msg.text);
    setActionMenuMsgId(null);
  };

  const handleEditSave = async () => {
    if (!user || !editingMsgId || !editText.trim()) return;
    const msgRef = doc(db, "groups", groupId, "messages", editingMsgId);
    await updateDoc(msgRef, { text: editText.trim(), edited: true });
    setEditingMsgId(null);
    setEditText("");
  };

  const handleEditCancel = () => {
    setEditingMsgId(null);
    setEditText("");
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
      joinType: editJoinType,
    });
    setGroup((g) => g ? { ...g, goal: editGoal.trim(), joinType: editJoinType } : g);
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
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Fixed header — Row 1 only */}
      <div className="shrink-0 bg-forest/95 backdrop-blur-md border-b border-forest-light/20 px-4 py-3 z-10" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
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

          <button onClick={() => setShowDetails(!showDetails)} className="flex-1 min-w-0 text-left active:opacity-70">
            <h1 className="font-bold text-sm truncate text-white/90">{group.groupName}</h1>
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              {modeInfo && (
                <span className="flex items-center gap-0.5">
                  <FocusModeIcon modeId={modeInfo.id} size={10} className="text-white/50" />
                  {modeInfo.label}
                </span>
              )}
              <span>· {group.memberCount}{isOfficial ? "" : "/10"}</span>
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-white/30 transition-transform ${showDetails ? "rotate-180" : ""}`}>
                <path d="M5 8L10 13L15 8" />
              </svg>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            {isLeader && (
              <button onClick={() => { setEditGoal(group.goal || ""); setShowSettings(true); }} className="w-10 h-10 flex items-center justify-center text-white/50">
                <IconEdit size={20} />
              </button>
            )}
            {isModeGroup ? (
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

        {/* Toggleable details: Goal + Members */}
        {showDetails && (
          <div className="mt-2">
            {/* Goal banner */}
            {group.goal ? (
              <div className="bg-forest-light/20 rounded-lg px-3 py-1.5 border border-accent-orange/20">
                <p className="text-[10px] font-bold text-accent-orange mb-0.5">Goal / Rules</p>
                <p className="text-xs text-white/70 leading-snug">{group.goal}</p>
              </div>
            ) : (
              <div className="bg-forest-light/10 rounded-lg px-3 py-2 border border-dashed border-white/20">
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
        )}
      </div>

      {/* Leader settings modal */}
      {showSettings && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowSettings(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center">
            <div className="w-full max-w-[430px] bg-white rounded-t-2xl p-5">
              <h3 className="font-bold text-sm mb-3">Community Settings</h3>

              <label className="block text-xs font-medium text-gray-500 mb-1">Who can join?</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setEditJoinType("open")}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    editJoinType === "open"
                      ? "bg-accent-orange text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  Anyone welcome
                </button>
                <button
                  type="button"
                  onClick={() => setEditJoinType("friends")}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                    editJoinType === "friends"
                      ? "bg-accent-orange text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  Friends only
                </button>
              </div>

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
          message="Are you sure you want to leave this community?"
          confirmLabel="Leave"
          confirmVariant="danger"
          onConfirm={handleLeaveConfirm}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}

      {showLeaderExitModal && group && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowLeaderExitModal(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[70dvh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm">Leave as Leader</h3>
              <button onClick={() => setShowLeaderExitModal(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center">&times;</button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {/* Transfer option */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-800 mb-1">Transfer Leadership</p>
                <p className="text-xs text-gray-500 mb-3">Choose a member to become the new leader. You will leave the group.</p>
                <div className="space-y-2">
                  {group.memberIds.filter((id) => id !== user?.uid).map((uid) => {
                    const member = memberProfiles[uid];
                    return (
                      <button
                        key={uid}
                        onClick={() => setTransferTarget(uid)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                          transferTarget === uid ? "bg-accent-orange/10 border border-accent-orange" : "bg-white border border-gray-200"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                          {member?.photoURL && <img src={member.photoURL} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="text-sm font-medium truncate">{member?.displayName || uid.slice(0, 8)}</span>
                        {transferTarget === uid && <span className="ml-auto text-accent-orange text-xs font-bold">Selected</span>}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleTransferAndLeave}
                  disabled={!transferTarget}
                  className="w-full mt-3 py-2.5 text-sm font-bold text-white bg-forest-mid rounded-full disabled:opacity-30"
                >
                  Transfer & Leave
                </button>
              </div>

              {/* Disband option */}
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm font-bold text-red-600 mb-1">Close Community</p>
                <p className="text-xs text-red-400 mb-3">Permanently close the group for all members. This cannot be undone.</p>
                <button
                  onClick={handleDisbandGroup}
                  className="w-full py-2.5 text-sm font-bold text-white bg-red-500 rounded-full active:bg-red-600"
                >
                  Close Community
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Scrollable area: Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1" style={{ scrollbarWidth: "none" }}>
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
          const displayName = isDeleted ? "Deleted" : (sender?.displayName || "...");

          if (isMe) {
            return (
              <div key={msg.id}>
                {/* Action menu */}
                {actionMenuMsgId === msg.id && !msg.unsent && (
                  <div className="flex justify-end gap-1 mb-0.5">
                    <button onClick={() => handleEditStart(msg)} className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded-full">Edit</button>
                    <button onClick={() => handleUnsend(msg.id)} className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Unsend</button>
                    <button onClick={() => setActionMenuMsgId(null)} className="text-[10px] text-white/30 px-1">✕</button>
                  </div>
                )}
                {/* Edit mode */}
                {editingMsgId === msg.id ? (
                  <div className="flex flex-col gap-1 items-end">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(sanitize(e.target.value).slice(0, MESSAGE_CHAR_LIMIT))}
                      onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                      className="border border-accent-orange rounded-lg px-3 py-1 text-sm text-black max-w-[70vw] focus:outline-none focus:ring-2 focus:ring-accent-orange"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button onClick={handleEditSave} className="text-[10px] text-accent-orange font-bold">Save</button>
                      <button onClick={handleEditCancel} className="text-[10px] text-white/40">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => !msg.unsent && setActionMenuMsgId(actionMenuMsgId === msg.id ? null : msg.id)}
                    onDoubleClick={() => !msg.unsent && handleReaction(msg.id, hasReacted)}
                    className="flex justify-end cursor-pointer select-none"
                  >
                    <p className={`text-sm max-w-[75vw] ${msg.unsent ? "text-white/30 italic" : "text-accent-orange"}`}>
                      {msg.unsent ? "unsent" : msg.text}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-1.5">
                  {!msg.unsent && (
                    <button onClick={() => handleReaction(msg.id, hasReacted)} className="text-xs">
                      <span className={`inline-flex items-center gap-0.5 ${hasReacted ? "text-red-500" : "text-white/20"}`}>
                        <IconKangaroo size={10} filled={hasReacted} />{reactionCount > 0 && <span className="text-[10px]">{reactionCount}</span>}
                      </span>
                    </button>
                  )}
                  {msg.edited && !msg.unsent && <span className="text-[9px] text-white/20 italic">edited</span>}
                  {timeStr && <span className="text-[9px] text-white/20">{timeStr}</span>}
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              onDoubleClick={() => !msg.unsent && handleReaction(msg.id, hasReacted)}
              className="flex items-start gap-2 select-none"
            >
              {/* Avatar */}
              {isDeleted ? (
                <div className="w-6 h-6 rounded-full bg-forest-light/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white/40 text-[8px]">?</span>
                </div>
              ) : (
                <button onClick={() => router.push(`/user/${msg.senderId}`)} className="shrink-0 mt-0.5">
                  <Avatar photoURL={sender?.photoURL} displayName={sender?.displayName || "?"} uid={msg.senderId} size={24} />
                </button>
              )}
              <div className="min-w-0">
                {/* Name: Message */}
                <p className="text-sm max-w-[75vw]">
                  <button
                    onClick={() => !isDeleted && router.push(`/user/${msg.senderId}`)}
                    className={`font-bold ${isDeleted ? "text-white/30 italic" : "text-white/60 active:text-accent-orange"}`}
                  >
                    {displayName}
                  </button>
                  <span className={msg.unsent ? "text-white/30 italic ml-1.5" : "text-white/90 ml-1.5"}>
                    {msg.unsent ? "unsent" : msg.text}
                  </span>
                </p>
                {/* Reaction + time */}
                <div className="flex items-center gap-1.5">
                  {!msg.unsent && (
                    <button onClick={() => handleReaction(msg.id, hasReacted)} className="text-xs">
                      <span className={`inline-flex items-center gap-0.5 ${hasReacted ? "text-red-500" : "text-white/20"}`}>
                        <IconKangaroo size={10} filled={hasReacted} />{reactionCount > 0 && <span className="text-[10px]">{reactionCount}</span>}
                      </span>
                    </button>
                  )}
                  {msg.edited && !msg.unsent && <span className="text-[9px] text-white/20 italic">edited</span>}
                  {timeStr && <span className="text-[9px] text-white/20">{timeStr}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isMember && (
        <div className="sticky bottom-0 bg-forest/95 backdrop-blur-md border-t border-forest-light/20 px-3 pt-2 pb-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}>
          {showWarn && <p className="text-red-400 text-xs font-bold mb-1 ml-1">English characters only</p>}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(sanitize(e.target.value).slice(0, MESSAGE_CHAR_LIMIT))}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Message..."
              maxLength={MESSAGE_CHAR_LIMIT}
              className="flex-1 border border-forest-light/30 bg-forest-light/20 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-orange placeholder-white/30"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="w-9 h-9 rounded-full bg-accent-orange flex items-center justify-center shrink-0 disabled:opacity-30 active:scale-[0.93] transition-transform"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="white" stroke="none">
                <path d="M2.5 10L17.5 2.5L14 10L17.5 17.5L2.5 10ZM2.5 10H14" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
