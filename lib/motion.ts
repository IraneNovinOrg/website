/**
 * Shared Framer Motion variants for consistent animations across the app.
 * Import into client components: `import { fadeUp, staggerContainer } from "@/lib/motion"`
 */

import type { Variants, Transition } from "framer-motion";

// ─── Easing curves ─────────────────────────────────────────────
export const easeOutExpo: Transition["ease"] = [0.16, 1, 0.3, 1];
export const easeSpring: Transition["ease"] = [0.34, 1.56, 0.64, 1];

// ─── Core variants ─────────────────────────────────────────────

/** Fade + small upward slide. Classic page/card entrance. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutExpo },
  },
};

/** Pure fade. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

/** Scale + fade. Good for modals, featured content. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: easeSpring },
  },
};

/** Slide in from left (use for LTR-correct directional motion). */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};

/** Slide in from right. */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
};

// ─── Container variants (for staggered children) ───────────────

/** Stagger children entrance (default: 80ms between each). */
export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

// ─── Interactive states (use as props, not variants) ───────────

/** Card hover: subtle lift + scale. Apply as `whileHover={cardHover}`. */
export const cardHover = {
  y: -4,
  scale: 1.01,
  transition: { duration: 0.2, ease: "easeOut" },
};

/** Button press. Apply as `whileTap={buttonTap}`. */
export const buttonTap = { scale: 0.97 };

/** Icon float (for hero emblem etc.). Use directly as animate prop. */
export const float = {
  y: [0, -8, 0],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

// ─── Page transition wrapper ───────────────────────────────────

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

// ─── Reduced motion fallback ───────────────────────────────────

export const respectReducedMotion = (variants: Variants, reducedMotion: boolean): Variants => {
  if (!reducedMotion) return variants;
  const flat: Variants = {};
  for (const key of Object.keys(variants)) {
    flat[key] = { opacity: key === "hidden" ? 0 : 1 };
  }
  return flat;
};
