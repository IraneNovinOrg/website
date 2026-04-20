import { cn } from "@/lib/utils";

interface SunMotifProps {
  className?: string;
  /** Enable slow rotation of the ray layers */
  spin?: boolean;
  /** Render a second counter-rotating ring of rays plus a pulsing glow */
  dual?: boolean;
  opacity?: number;
}

/**
 * Decorative sun burst — classical Persian khorshid motif.
 *
 * - `spin`: slow rotation (30s per revolution)
 * - `dual`: adds a second, slightly smaller layer spinning the opposite way
 *   and a soft pulsing golden glow at the center.
 */
export function SunMotif({
  className,
  spin = false,
  dual = false,
  opacity = 1,
}: SunMotifProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative", className)}
      style={{ opacity }}
    >
      {/* Primary ray layer */}
      <div className={cn("absolute inset-0", spin && "animate-sun-spin")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/sun-rays.svg"
          alt=""
          className="h-full w-full"
          draggable={false}
        />
      </div>

      {dual && (
        <>
          {/* Counter-rotating secondary layer (scaled down via keyframe, offset speed) */}
          <div
            className={cn(
              "absolute inset-0 opacity-60",
              spin ? "animate-sun-spin-reverse" : "scale-[0.78]"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/sun-rays.svg"
              alt=""
              className="h-full w-full"
              draggable={false}
            />
          </div>

          {/* Pulsing radial glow at center */}
          <div
            className="pointer-events-none absolute inset-0 m-auto animate-sun-glow-pulse rounded-full"
            style={{
              width: "40%",
              height: "40%",
              background:
                "radial-gradient(circle, rgba(244,180,60,0.55) 0%, rgba(212,168,67,0.25) 45%, transparent 75%)",
              filter: "blur(8px)",
            }}
          />
        </>
      )}
    </div>
  );
}

export default SunMotif;
