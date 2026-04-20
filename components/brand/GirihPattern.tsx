import { cn } from "@/lib/utils";

type Position = "full" | "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center";

interface GirihPatternProps {
  /** Where to position the pattern overlay */
  position?: Position;
  /** Opacity (0 to 1). Default: 0.06 for subtlety */
  opacity?: number;
  /** Color (uses Tailwind colors via text-*) */
  color?: string;
  /** Tile size in pixels */
  size?: number;
  /** Additional classes */
  className?: string;
}

const POSITION_CLASSES: Record<Position, string> = {
  full: "inset-0",
  "top-right": "top-0 end-0 w-1/2 h-1/2",
  "top-left": "top-0 start-0 w-1/2 h-1/2",
  "bottom-right": "bottom-0 end-0 w-1/2 h-1/2",
  "bottom-left": "bottom-0 start-0 w-1/2 h-1/2",
  center: "inset-0 m-auto w-3/4 h-3/4",
};

/**
 * Decorative Persian Girih pattern overlay.
 * Positioned absolutely within a relative parent.
 * Use sparingly — typical opacity 0.05 to 0.1.
 */
export function GirihPattern({
  position = "full",
  opacity = 0.06,
  color = "text-current",
  size = 120,
  className,
}: GirihPatternProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute",
        POSITION_CLASSES[position],
        color,
        className
      )}
      style={{
        opacity,
        backgroundImage: "url(/brand/girih-pattern.svg)",
        backgroundSize: `${size}px ${size}px`,
        backgroundRepeat: "repeat",
      }}
    />
  );
}

export default GirihPattern;
