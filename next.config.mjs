import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Shared security headers applied to every route. Intentionally conservative:
//  - HSTS only takes effect when the response is served over https (Cloudflare
//    tunnels terminate TLS, so iranenovin.com gets it; localhost is skipped).
//  - No full CSP yet — the app uses next/font, framer-motion, markdown,
//    Telegram embeds, and OAuth redirects, and locking those down without
//    breakage needs a separate tuning pass. We ship the high-ROI headers now.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  // Don't leak the X-Powered-By fingerprint.
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
