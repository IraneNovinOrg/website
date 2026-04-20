"use client";

/**
 * Last-resort error boundary for failures above the locale layout
 * (middleware routing fails, NextIntlProvider throws at mount, etc).
 * Must include its own <html>/<body> per the Next.js app-router contract.
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background:
            "linear-gradient(135deg, #0B4D29 0%, #009B3A 60%, #DA8B00 100%)",
          color: "white",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-1px" }}>
            IranENovin
          </div>
          <p style={{ fontSize: 18, opacity: 0.9, marginTop: 12 }}>
            Something broke at the root of the app. Reloading the page is the
            fastest way to recover.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
              Reference: <code>{error.digest}</code>
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              borderRadius: 9999,
              border: "1px solid rgba(255,255,255,0.7)",
              background: "rgba(255,255,255,0.1)",
              color: "white",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
