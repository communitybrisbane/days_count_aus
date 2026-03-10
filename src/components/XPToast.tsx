"use client";

import { motion, AnimatePresence } from "framer-motion";

interface XPToastProps {
  xp: number;
  show: boolean;
}

export default function XPToast({ xp, show }: XPToastProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", damping: 15, stiffness: 300 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] pointer-events-none"
        >
          <div className="bg-gray-900/90 backdrop-blur-sm text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2">
            <motion.span
              initial={{ rotate: -20, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
              className="text-aussie-gold font-black text-lg"
            >
              +{xp}
            </motion.span>
            <span className="text-sm font-medium text-gray-300">XP</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
