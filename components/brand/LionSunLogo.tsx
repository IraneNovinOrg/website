"use client";

import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "hero";

const SIZE_CLASSES: Record<LogoSize, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
  "2xl": "h-32 w-32",
  "3xl": "h-48 w-48",
  hero: "h-56 w-56 md:h-64 md:w-64",
};

interface LionSunLogoProps {
  size?: LogoSize;
  variant?: "full" | "mini";
  className?: string;
  animate?: boolean;
  /** Wrap logo in a white circular backdrop (ideal for hero sections) */
  backdrop?: boolean;
}

/**
 * Lion & Sun emblem — the brand mark of IranENovin.
 * Uses images in /public/brand/. Two variants:
 *   - full: detailed emblem with lion, mane, sword, 12 sun rays
 *   - mini: simplified for small sizes (favicon, compact navbar)
 *
 * Override mechanism:
 *   The component first tries /brand/custom/<filename>. If that
 *   file is missing (404), it falls back to /brand/<filename>.
 *   Drop replacement files into public/brand/custom/ to rebrand
 *   without touching code. See public/brand/custom/README.txt.
 */
const FULL_CHAIN = [
  "/brand/iranenovin_no_bg1_white.png",
  "/brand/iranenovin_no_bg1_white_logo.png",
  "/brand/iranenovin_no_bg.jpg",
  "/brand/custom/iranenovin_1.png",
  "/brand/custom/lion-and-sun.svg",
  "/brand/lion-and-sun.svg",
];

const MINI_CHAIN = [
  "/brand/iranenovin_no_bg1_white_logo.png",
  "/brand/iranenovin_no_bg1_white.png",
  "/brand/iranenovin_no_bg.jpg",
  "/brand/custom/iranenovin_1.png",
  "/brand/custom/lion-and-sun-mini.svg",
  "/brand/lion-and-sun-mini.svg",
];

export function LionSunLogo({
  size = "md",
  variant = "full",
  className,
  animate = false,
  backdrop = false,
}: LionSunLogoProps) {
  // Auto-select mini for xs/sm sizes
  const effectiveVariant =
    (size === "xs" || size === "sm") && variant === "full" ? "mini" : variant;
  const chain = effectiveVariant === "mini" ? MINI_CHAIN : FULL_CHAIN;

  const img = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        backdrop ? "rounded-full" : "",
        SIZE_CLASSES[size],
        animate && "animate-float",
        className
      )}
      aria-label="IranENovin - Lion and Sun"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={chain[0]}
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
        onError={(e) => {
          const imgEl = e.currentTarget;
          const currentIdx = chain.indexOf(imgEl.src.replace(window.location.origin, ""));
          const next = currentIdx >= 0 ? currentIdx + 1 : 1;
          if (next < chain.length) {
            imgEl.src = chain[next];
          }
        }}
      />
    </span>
  );

  if (backdrop) {
    return (
      <div className="inline-flex items-center justify-center rounded-full bg-white p-3 shadow-2xl ring-4 ring-white/50 md:p-4">
        {img}
      </div>
    );
  }

  return img;
}

export default LionSunLogo;
