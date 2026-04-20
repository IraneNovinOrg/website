import { cn } from "@/lib/utils";

interface IranMapProps {
  /** Additional classes — typically absolute positioning + sizing */
  className?: string;
  /** Opacity (0 to 1). Default: 0.06 for decorative use */
  opacity?: number;
  /** Tailwind `text-*` class controlling the currentColor of the stroke */
  color?: string;
}

/**
 * Decorative outline of the country of Iran.
 * Uses the /brand/iran-map.svg asset (stroke = currentColor).
 * Position absolutely within a relative parent.
 * Mirrors the API of `GirihPattern` for consistency.
 */
export function IranMap({
  className,
  opacity = 0.06,
  color = "text-current",
}: IranMapProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute", color, className)}
      style={{ opacity }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/iran-map.svg"
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
}

export default IranMap;
