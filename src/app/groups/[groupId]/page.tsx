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
  where,
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
import { fetchUserGroups, isModeGroup as isModeGroupCheck } from "@/lib/groups";
import { FOCUS_MODES, MAX_GROUP_MEMBERS, MESSAGE_CHAR_LIMIT, GROUP_JOIN_LEVEL, getMaxCommunitySlots, resolveMode } from "@/lib/constants";
import Image from "next/image";
import Avatar from "@/components/Avatar";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConfirmModal from "@/components/ConfirmModal";
import { FocusModeIcon, IconKangaroo, IconCamera, IconEdit } from "@/components/icons";
import type { Group } from "@/types";
import { compressImage } from "@/lib/imageUtils";
import { useAsciiInput, NON_ASCII_EMOJI_MULTILINE } from "@/hooks/useAsciiInput";
import { emitGroupRead } from "@/hooks/useUnreadGroups";

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
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { displayName?: string; photoURL?: string; totalXP?: number; _deleted?: boolean }>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [editGoal, setEditGoal] = useState("");
  const [editJoinType, setEditJoinType] = useState<"open" | "friends">("open");
  const [savingSettings, setSavingSettings] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showLinkWarn, setShowLinkWarn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [clearedAt, setClearedAt] = useState<Timestamp | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Fetch group & auto-join official group if not yet a member
  useEffect(() => {
    async function fetchGroup() {
      const snap = await getDoc(doc(db, "groups", groupId));
      if (!snap.exists()) return;
      const data = { id: snap.id, ...snap.data() } as Group;

      setGroup(data);
      setEditGoal(data.goal || "");
      setEditJoinType(data.joinType || "open");
    }
    if (user) fetchGroup().catch((err) => console.error("fetchGroup error:", err));
  }, [groupId, user]);

  // Load lastRead (muted/clearedAt) FIRST, then subscribe to messages
  const isMemberNow = group?.memberIds?.includes(user?.uid || "");
  const [lastReadLoaded, setLastReadLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLastReadLoaded(false);
    getDoc(doc(db, "groups", groupId, "lastRead", user.uid)).then((snap) => {
      if (snap.exists()) {
        setMuted(!!snap.data().muted);
        if (snap.data().clearedAt) setClearedAt(snap.data().clearedAt as Timestamp);
      }
    }).catch(() => {}).finally(() => setLastReadLoaded(true));
  }, [user, groupId]);

  // Real-time messages — only subscribe after lastRead is loaded
  useEffect(() => {
    if (!isMemberNow || !lastReadLoaded) return;
    const constraints = [
      orderBy("createdAt", "asc"),
      ...(clearedAt ? [where("createdAt", ">", clearedAt)] : []),
      limitToLast(100),
    ];
    const q = query(collection(db, "groups", groupId, "messages"), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    }, (err) => {
      console.warn("Messages listener error:", err);
    });
    return unsub;
  }, [groupId, isMemberNow, lastReadLoaded, clearedAt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read when viewing messages (preserve clearedAt via merge)
  useEffect(() => {
    if (user && isMemberNow && messages.length > 0) {
      setDoc(doc(db, "groups", groupId, "lastRead", user.uid), {
        readAt: serverTimestamp(),
        muted,
      }, { merge: true }).catch(() => {});
      emitGroupRead(groupId);
    }
  }, [user, groupId, messages.length]);

  // Fetch member profiles — only fetch new/unknown IDs, cache results
  useEffect(() => {
    if (!group) return;
    async function fetchMembers() {
      const senderIds = messages.map((m) => m.senderId);
      const allIds = [...new Set([...group!.memberIds, ...senderIds])];
      // Only fetch IDs we don't already have
      const missingIds = allIds.filter((uid) => !memberProfiles[uid]);
      if (missingIds.length === 0) return;

      const snaps = await Promise.all(
        missingIds.map((uid) => getDoc(doc(db, "users", uid)))
      );
      const newProfiles: Record<string, any> = {};
      snaps.forEach((snap, i) => {
        if (snap.exists()) {
          newProfiles[missingIds[i]] = snap.data();
        } else {
          newProfiles[missingIds[i]] = { displayName: "Deleted Account", _deleted: true };
        }
      });
      setMemberProfiles((prev) => ({ ...prev, ...newProfiles }));
    }
    fetchMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.memberIds?.join(","), messages.length]);

  const isModeGroup = !!group && isModeGroupCheck(group);
  const isMember = isMemberNow;
  const isLeader = group?.creatorId === user?.uid;
  const isFull = !isModeGroup && (group?.memberCount || 0) >= MAX_GROUP_MEMBERS;
  const modeInfo = FOCUS_MODES.find((m) => m.id === resolveMode(group?.mode || ""));

  const userLevel = profile ? calculateLevel(profile.totalXP) : 0;

  const [showFriendsConfirm, setShowFriendsConfirm] = useState(false);

  const handleJoinAttempt = async () => {
    if (!user || !group || isFull || profile?.restricted) return;
    if (group.kickedUserIds?.includes(user.uid)) {
      alert("You cannot rejoin this group.");
      return;
    }
    // Mode groups are open to everyone — level and slot limits apply to communities only
    if (!isModeGroup) {
      if (userLevel < GROUP_JOIN_LEVEL) {
        alert(`You need Lv.${GROUP_JOIN_LEVEL} or higher to join a community.`);
        return;
      }
      // Membership slots: level-tiered cap on communities you belong to (created or joined; mode groups are free)
      const maxSlots = getMaxCommunitySlots(userLevel);
      const myGroups = await fetchUserGroups(profile?.groupIds || []);
      const communityCount = myGroups.filter((g) => !isModeGroupCheck(g)).length;
      if (communityCount >= maxSlots) {
        alert(`Your community slots are full (${communityCount}/${maxSlots}). Please leave one first.`);
        return;
      }
    }
    if (group.joinType === "friends") {
      setShowFriendsConfirm(true);
      return;
    }
    await performJoin();
  };

  const addSystemMessage = async (text: string) => {
    await addDoc(collection(db, "groups", groupId, "messages"), {
      senderId: "system",
      text,
      createdAt: serverTimestamp(),
      reactions: {},
    });
  };

  const performJoin = async () => {
    if (!user || !group) return;
    await updateDoc(doc(db, "groups", groupId), {
      memberIds: arrayUnion(user.uid),
      memberCount: increment(1),
    });
    // New members only see messages sent after they joined
    const joinedAt = Timestamp.now();
    await setDoc(doc(db, "groups", groupId, "lastRead", user.uid), { clearedAt: joinedAt }, { merge: true });
    setClearedAt(joinedAt);
    await updateDoc(doc(db, "users", user.uid), { groupIds: arrayUnion(groupId) });
    await addSystemMessage(`${profile?.displayName || "Someone"} joined the group`);
    setGroup((g) => g ? { ...g, memberIds: [...g.memberIds, user.uid], memberCount: g.memberCount + 1 } : g);
    await refreshProfile();
  };

  const [showLeaderExitModal, setShowLeaderExitModal] = useState(false);
  const [finalMessage, setFinalMessage] = useState("");
  const [disbanding, setDisbanding] = useState(false);

  const handleLeaveConfirm = async () => {
    if (!user || !group) return;
    setShowLeaveModal(false);
    if (isLeader && !isModeGroup) {
      // Leader leaving disbands the group. With members present, offer one final message first.
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
    await addSystemMessage(`${profile?.displayName || "Someone"} left the group`);
    await updateDoc(doc(db, "groups", groupId), {
      memberIds: arrayRemove(user.uid),
      memberCount: increment(-1),
    });
    await updateDoc(doc(db, "users", user.uid), { groupIds: arrayRemove(groupId) });
    await refreshProfile();
    router.replace("/groups");
  };

  const handleLeaderDisband = async () => {
    if (!user || !group || disbanding) return;
    // Same input rules as regular chat messages
    const farewell = finalMessage.trim().slice(0, MESSAGE_CHAR_LIMIT);
    if (farewell && URL_PATTERN.test(farewell)) {
      alert("Links are not allowed in group chat.");
      return;
    }
    setDisbanding(true);
    try {
      // Final message must go out before the group is closed (closed groups are read-only)
      if (farewell) {
        await addDoc(collection(db, "groups", groupId, "messages"), {
          senderId: user.uid,
          text: farewell,
          createdAt: serverTimestamp(),
          reactions: {},
        });
      }
      await addSystemMessage("The leader has left — this group is now closed");
      await updateDoc(doc(db, "groups", groupId), { isClosed: true });
      await updateDoc(doc(db, "users", user.uid), { groupIds: arrayRemove(groupId) });
      await refreshProfile();
      setShowLeaderExitModal(false);
      router.replace("/groups");
    } finally {
      setDisbanding(false);
    }
  };

  const handleKick = async (uid: string) => {
    if (!isLeader || !group) return;
    if (!confirm("Kick this member?")) return;
    const kickedName = memberProfiles[uid]?.displayName || "A member";
    await addSystemMessage(`${kickedName} was removed from the group`);
    await updateDoc(doc(db, "groups", groupId), {
      memberIds: arrayRemove(uid),
      memberCount: increment(-1),
      kickedUserIds: arrayUnion(uid),
    });
    // groupIds cleanup + kickedFrom notification handled by syncGroupMembership Cloud Function
    setGroup((g) => g ? {
      ...g,
      memberIds: g.memberIds.filter((id) => id !== uid),
      memberCount: g.memberCount - 1,
    } : g);
  };

  const URL_PATTERN = /https?:\/\/|www\./i;

  const handleSend = async () => {
    if (!user || !text.trim() || !isMember || profile?.restricted) return;
    const msg = text.trim();
    if (URL_PATTERN.test(msg)) {
      alert("Links are not allowed in group chat.");
      return;
    }
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
    if (!user || profile?.restricted) return;
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
    // Update group preview if this was the last message
    await updateDoc(doc(db, "groups", groupId), {
      lastMessageText: "Message unsent",
    });
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

  const handleToggleMute = async () => {
    if (!user) return;
    const newMuted = !muted;
    setMuted(newMuted);
    await setDoc(doc(db, "groups", groupId, "lastRead", user.uid), {
      readAt: serverTimestamp(),
      muted: newMuted,
    }).catch(() => {});
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

  const isClosed = !!group.isClosed;

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Fixed header — Row 1 only */}
      <div className="shrink-0 bg-forest/95 backdrop-blur-md border-b border-forest-light/20 px-4 py-3 z-10" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center text-white/60 text-xl -ml-2">
            ←
          </button>
          {/* Group icon */}
          <div className="shrink-0">
            {group.iconUrl ? (
              <Image src={group.iconUrl} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-forest-light/30 flex items-center justify-center">
                <FocusModeIcon modeId={group.mode || ""} size={22} className="text-white/60" />
              </div>
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
              <span>· {group.memberCount}{isModeGroup ? " members" : `/${MAX_GROUP_MEMBERS}`}</span>
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-white/30 transition-transform ${showDetails ? "rotate-180" : ""}`}>
                <path d="M5 8L10 13L15 8" />
              </svg>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {isLeader && !isClosed && (
              <button onClick={() => { setEditGoal(group.goal || ""); setShowSettings(true); }} className="w-9 h-9 flex items-center justify-center text-white/50">
                <IconEdit size={18} />
              </button>
            )}
            {isClosed ? (
              <span className="text-xs text-red-400/70 px-2 py-1">Closed</span>
            ) : isModeGroup && !isMember ? (
              <button onClick={handleJoinAttempt} className="bg-accent-orange text-white text-sm px-4 py-1.5 rounded-full flex items-center gap-1">
                Join
              </button>
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
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowSettings(false)} aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center">
            <div className="w-full max-w-[430px] bg-white rounded-t-2xl p-5">
              <h3 className="font-bold text-sm mb-3">Community Settings</h3>

              <label className="block text-xs font-medium text-gray-500 mb-1">Group Icon</label>
              <button
                onClick={() => iconInputRef.current?.click()}
                className="flex items-center gap-2 mb-3 px-3 py-2 bg-gray-100 rounded-xl active:bg-gray-200 transition-colors"
              >
                {group.iconUrl ? (
                  <Image src={group.iconUrl} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-forest-light/20 flex items-center justify-center">
                    <FocusModeIcon modeId={group.mode || ""} size={16} className="text-forest-mid" />
                  </div>
                )}
                <span className="text-xs text-gray-500 font-medium">Change icon</span>
                <IconCamera size={14} className="text-gray-400 ml-auto" />
              </button>

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
                onChange={(e) => setEditGoal(sanitize(e.target.value, NON_ASCII_EMOJI_MULTILINE))}
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

      {showFriendsConfirm && (
        <ConfirmModal
          title="Friends Only Group"
          message={`This is a group for people who know each other. Are you friends with the leader${memberProfiles[group?.creatorId || ""]?.displayName ? ` (${memberProfiles[group!.creatorId].displayName})` : ""}? Only join if you know them.`}
          confirmLabel="Join"
          onConfirm={async () => { setShowFriendsConfirm(false); await performJoin(); }}
          onCancel={() => setShowFriendsConfirm(false)}
        />
      )}

      {showLeaveModal && (
        <ConfirmModal
          title="Leave Community"
          message={isLeader && !isModeGroup ? "You are the leader — leaving will close this community for everyone." : "Are you sure you want to leave this community?"}
          confirmLabel="Leave"
          confirmVariant="danger"
          onConfirm={handleLeaveConfirm}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}

      {showLeaderExitModal && group && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowLeaderExitModal(false)} aria-hidden="true" />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl max-h-[70dvh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-sm">Leave &amp; Close Community</h3>
              <button onClick={() => setShowLeaderExitModal(false)} className="text-gray-400 text-lg w-8 h-8 flex items-center justify-center" aria-label="Close">&times;</button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm font-bold text-red-600 mb-1">Leaving closes this community</p>
                <p className="text-xs text-red-400">When the leader leaves, the group is closed for all members. This cannot be undone. Members can still read past messages.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 mb-1">Final message <span className="font-normal text-gray-400">(optional)</span></p>
                <p className="text-xs text-gray-500 mb-2">Leave one last message for your members before the group closes.</p>
                <textarea
                  value={finalMessage}
                  onChange={(e) => setFinalMessage(sanitize(e.target.value).slice(0, MESSAGE_CHAR_LIMIT))}
                  maxLength={MESSAGE_CHAR_LIMIT}
                  rows={3}
                  placeholder="Thanks for everything, everyone!"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-forest-mid"
                />
                {showWarn && <p className="text-[10px] text-red-400 mt-1">English characters only</p>}
                <p className="text-[10px] text-gray-400 mt-1 text-right">{finalMessage.length}/{MESSAGE_CHAR_LIMIT}</p>
              </div>
              <button
                onClick={handleLeaderDisband}
                disabled={disbanding}
                className="w-full py-2.5 text-sm font-bold text-white bg-red-500 rounded-full active:bg-red-600 disabled:opacity-50"
              >
                {disbanding ? "Closing..." : finalMessage.trim() ? "Send & Close Community" : "Close Community"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Scrollable area: Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5" style={{ scrollbarWidth: "none" }}>
        {messages.map((msg) => {
          if (msg.senderId === "system") {
            return (
              <div key={msg.id} className="flex justify-center py-1">
                <span className="text-[11px] text-white/30 bg-white/5 px-3 py-1 rounded-full">{msg.text}</span>
              </div>
            );
          }

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
              <div key={msg.id} className="flex flex-col items-end">
                {/* Action menu */}
                {actionMenuMsgId === msg.id && !msg.unsent && (
                  <div className="flex gap-1 mb-0.5">
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
                      className="border border-accent-orange rounded-xl px-3 py-1.5 text-sm text-black max-w-[70vw] focus:outline-none focus:ring-2 focus:ring-accent-orange"
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
                    className={`px-3 py-2 rounded-2xl rounded-br-sm max-w-[70vw] cursor-pointer select-none ${msg.unsent ? "bg-white/5 text-white/30 italic" : "bg-accent-orange text-white"}`}
                  >
                    <p className="text-sm">{msg.unsent ? "This message was unsent" : msg.text}</p>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-0.5 mr-1">
                  {!msg.unsent && (
                    <button onClick={() => handleReaction(msg.id, hasReacted)} className="text-xs">
                      <span className={`inline-flex items-center gap-0.5 ${hasReacted ? "text-red-500" : "text-white/20"}`}>
                        <IconKangaroo size={12} filled={hasReacted} />{reactionCount > 0 && <span className="text-[10px]">{reactionCount}</span>}
                      </span>
                    </button>
                  )}
                  {msg.edited && !msg.unsent && <span className="text-[10px] text-white/20 italic">edited</span>}
                  {timeStr && <span className="text-[10px] text-white/20">{timeStr}</span>}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2 select-none">
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
              <div className="min-w-0 max-w-[70vw]">
                {/* Name */}
                <button
                  onClick={() => !isDeleted && router.push(`/user/${msg.senderId}`)}
                  className={`text-[11px] font-bold mb-0.5 block ${isDeleted ? "text-white/30 italic" : "text-white/50 active:text-accent-orange"}`}
                >
                  {displayName}
                </button>
                {/* Bubble */}
                <div
                  onDoubleClick={() => !msg.unsent && handleReaction(msg.id, hasReacted)}
                  className={`px-3 py-2 rounded-2xl rounded-tl-sm w-fit ${msg.unsent ? "bg-white/5 text-white/30 italic" : "bg-forest-light/25 text-white/90"}`}
                >
                  <p className="text-sm">{msg.unsent ? "This message was unsent" : msg.text}</p>
                </div>
                {/* Reaction + time */}
                <div className="flex items-center gap-1.5 mt-0.5 ml-1">
                  {!msg.unsent && (
                    <button onClick={() => handleReaction(msg.id, hasReacted)} className="text-xs">
                      <span className={`inline-flex items-center gap-0.5 ${hasReacted ? "text-red-500" : "text-white/20"}`}>
                        <IconKangaroo size={12} filled={hasReacted} />{reactionCount > 0 && <span className="text-[10px]">{reactionCount}</span>}
                      </span>
                    </button>
                  )}
                  {msg.edited && !msg.unsent && <span className="text-[10px] text-white/20 italic">edited</span>}
                  {timeStr && <span className="text-[10px] text-white/20">{timeStr}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input or closed banner */}
      {isMember && !isClosed && (
        <div className="sticky bottom-0 bg-forest/95 backdrop-blur-md border-t border-forest-light/20 px-3 pt-2 pb-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}>
          {profile?.restricted && <p className="text-red-400 text-xs font-bold mb-1 ml-1 text-center">This account has been restricted</p>}
          {showWarn && <p className="text-red-400 text-xs font-bold mb-1 ml-1">English characters only</p>}
          {showLinkWarn && <p className="text-red-400 text-xs font-bold mb-1 ml-1">Links are not allowed</p>}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => {
                const v = sanitize(e.target.value).slice(0, MESSAGE_CHAR_LIMIT);
                if (URL_PATTERN.test(v)) {
                  setShowLinkWarn(true);
                  setTimeout(() => setShowLinkWarn(false), 2000);
                  return;
                }
                setText(v);
              }}
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
      {isMember && isClosed && (
        <div className="sticky bottom-0 bg-forest/95 backdrop-blur-md border-t border-forest-light/20 px-3 pt-2 pb-3 text-center" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}>
          <p className="text-white/40 text-xs mb-2">This group has been closed. You can still read messages.</p>
          <button
            onClick={async () => {
              if (!user) return;
              await updateDoc(doc(db, "groups", groupId), {
                memberIds: arrayRemove(user.uid),
                memberCount: increment(-1),
              });
              await updateDoc(doc(db, "users", user.uid), { groupIds: arrayRemove(groupId) });
              await refreshProfile();
              router.replace("/groups");
            }}
            className="text-sm text-red-400 font-medium px-4 py-1.5 border border-red-400/30 rounded-full"
          >
            Leave
          </button>
        </div>
      )}
    </div>
  );
}
