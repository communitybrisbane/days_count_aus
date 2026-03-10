"use client";

import { motion, AnimatePresence } from "framer-motion";

interface LevelUpAnimationProps {
  level: number;
  show: boolean;
  onClose: () => void;
}

const CONFETTI_COLORS = ["#FFB800", "#0077BE", "#B85C38", "#34D399", "#F472B6", "#A78BFA"];

export default function LevelUpAnimation({ level, show, onClose }: LevelUpAnimationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="relative bg-white rounded-3xl p-8 mx-6 text-center max-w-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Burst rays */}
            <motion.div
              initial={{ scale: 0, rotate: 0 }}
              animate={{ scale: 1.2, rotate: 180 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-48 h-48 rounded-full bg-gradient-to-r from-aussie-gold/20 to-amber-200/10" />
            </motion.div>

            {/* Level number */}
            <motion.div
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 8, stiffness: 150, delay: 0.15 }}
              className="relative"
            >
              <p className="text-sm font-bold text-gray-400 mb-1">LEVEL UP!</p>
              <p className="text-6xl font-black text-aussie-gold leading-none">
                {level}
              </p>
            </motion.div>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative text-gray-500 text-sm mt-3"
            >
              Keep going!
            </motion.p>

            {/* Tap to close */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              onClick={onClose}
              className="relative mt-5 bg-aussie-gold text-white font-bold px-8 py-2.5 rounded-full text-sm"
            >
              OK
            </motion.button>

            {/* Confetti particles */}
            {[...Array(16)].map((_, i) => {
              const angle = (i / 16) * Math.PI * 2;
              const distance = 80 + Math.random() * 40;
              return (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    top: "50%",
                    left: "50%",
                  }}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    scale: [0, 1.2, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1,
                    delay: 0.2 + i * 0.03,
                    ease: "easeOut",
                  }}
                />
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
