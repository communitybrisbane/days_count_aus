"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface NotificationToastProps {
  show: boolean;
  title: string;
  body: string;
  link?: string;
  type?: "like" | "group_message" | "streak";
  icon?: string;
  onDismiss: () => void;
}

export default function NotificationToast({ show, title, body, link, type, icon, onDismiss }: NotificationToastProps) {
  const router = useRouter();

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [show, onDismiss]);

  const handleTap = () => {
    onDismiss();
    if (link) router.push(link);
  };

  const isLike = type === "like";
  const isMessage = type === "group_message";
  const isStreak = type === "streak";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, info) => { if (info.offset.y < -30) onDismiss(); }}
          onClick={handleTap}
          className={`fixed top-3 left-4 right-4 z-[100] mx-auto max-w-[410px] shadow-xl rounded-xl border cursor-pointer active:scale-[0.98] transition-transform ${
            isLike
              ? "bg-gradient-to-r from-orange-50 to-white border-orange-200"
              : isMessage
              ? "bg-gradient-to-r from-green-50 to-white border-green-200"
              : isStreak
              ? "bg-gradient-to-r from-red-50 to-white border-red-200"
              : "bg-white border-gray-100"
          }`}
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex items-center gap-3 px-4 pb-3">
            {/* Icon */}
            {isMessage && icon ? (
              <img src={icon} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
            ) : isMessage ? (
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <span className="text-base">💬</span>
              </div>
            ) : isLike ? (
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <span className="text-base">🦘</span>
              </div>
            ) : isStreak ? (
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-base">🔥</span>
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <span className="text-base">🔔</span>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 leading-tight truncate">{title}</p>
              {body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{body}</p>}
            </div>

            {/* Time indicator */}
            <span className="text-[10px] text-gray-300 shrink-0">now</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
