import { ImageResponse } from "next/og";

// Auto-served at /opengraph-image at 1200×630 (the OG standard).
// Next.js reads this file, runs the component through ImageResponse, and
// caches the PNG. No static asset needed.
export const runtime = "edge";
export const alt = "IranENovin — Build Iran's Future Together";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0B4D29 0%, #009B3A 40%, #DA8B00 100%)",
          color: "white",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 30% 20%, rgba(255,215,0,0.22), transparent 40%), radial-gradient(circle at 80% 80%, rgba(218,139,0,0.25), transparent 45%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
            zIndex: 1,
          }}
        >
          {/* Simple sun-ray ornament so the card reads as the brand even
              without the raster logo. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 140,
              height: 140,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #FFD700 0%, #DA8B00 70%, transparent 75%)",
              boxShadow: "0 0 60px rgba(255,215,0,0.45)",
              fontSize: 72,
              lineHeight: 1,
            }}
          >
            ☀
          </div>

          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: "-2px",
              textAlign: "center",
              textShadow: "0 4px 30px rgba(0,0,0,0.35)",
            }}
          >
            IranENovin
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 400,
              opacity: 0.96,
              textAlign: "center",
              maxWidth: 1000,
              lineHeight: 1.25,
            }}
          >
            Build Iran&apos;s Future — Together.
          </div>
          <div
            style={{
              fontSize: 28,
              opacity: 0.85,
              marginTop: 16,
              letterSpacing: 1,
            }}
          >
            ایران نوین · iranenovin.com
          </div>
        </div>
      </div>
    ),
    size
  );
}
