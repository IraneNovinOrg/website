import type { MetadataRoute } from "next";

/**
 * App-router robots file. Next.js serves this as `/robots.txt`.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://iranenovin.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/en/admin", "/fa/admin"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
