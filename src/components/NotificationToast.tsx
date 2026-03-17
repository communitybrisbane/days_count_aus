"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface NotificationToastProps {
  show: boolean;
  title: string;
  body: string;
  link?: string;
  onDismiss: () => void;
}

export default function NotificationToast({ show, title, body, link, onDismiss }: NotificationToastProps) {
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
          className="fixed top-3 left-4 right-4 z-[100] mx-auto max-w-[410px] bg-white shadow-xl rounded-xl border border-gray-100 px-4 py-3 cursor-pointer active:scale-[0.98] transition-transform"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
        >
          <p className="text-sm font-bold text-gray-800 leading-tight">{title}</p>
          {body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{body}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
