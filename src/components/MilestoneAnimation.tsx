"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MilestoneIcon, IconBoomerang } from "./icons";

interface MilestoneAnimationProps {
  dayNumber: number;
  show: boolean;
  onClose: () => void;
}

const milestoneMessages: Record<number, string> = {
  30: "30 Days! Great start!",
  100: "100 Days! You're on fire!",
  200: "200 Days! Unstoppable!",
  365: "365 Days! You made it!",
};

export default function MilestoneAnimation({ dayNumber, show, onClose }: MilestoneAnimationProps) {
  const message = milestoneMessages[dayNumber];
  if (!message) return null;

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
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="bg-white rounded-3xl p-8 mx-6 text-center max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-7xl mb-4"
            >
              <MilestoneIcon dayNumber={dayNumber} size={72} className="text-accent-orange" />
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-black text-accent-orange mb-2"
            >
              D + {dayNumber}
            </motion.h2>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-gray-600 font-medium"
            >
              {message}
            </motion.p>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <button
                onClick={onClose}
                className="mt-6 bg-accent-orange text-white font-bold px-8 py-3 rounded-full"
              >
                <span className="flex items-center gap-1.5">Keep Going! <IconBoomerang size={18} className="text-white" /></span>
              </button>
            </motion.div>

            {/* Confetti-like dots */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  backgroundColor: ["#FFB800", "#0077BE", "#B85C38", "#34D399"][i % 4],
                  top: `${20 + Math.random() * 60}%`,
                  left: `${10 + Math.random() * 80}%`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  y: [0, -50 - Math.random() * 50],
                }}
                transition={{ duration: 1.5, delay: 0.5 + i * 0.1, repeat: Infinity, repeatDelay: 2 }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
