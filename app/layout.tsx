import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "IranENovin — Build Iran's Future Together",
    template: "%s · IranENovin",
  },
  description:
    "A collaborative platform where every Iranian can contribute to building a better future. Submit ideas, vote, collaborate on projects, and help shape the next chapter of Iran together.",
  keywords: [
    "Iran",
    "ایران نوین",
    "civic tech",
    "collaboration",
    "community platform",
    "IranAzadAbad",
    "projects",
    "ideas",
  ],
  authors: [{ name: "IranENovin Community" }],
  creator: "IranENovin Community",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://iranenovin.com"
  ),
  openGraph: {
    type: "website",
    siteName: "IranENovin",
    title: "IranENovin — Build Iran's Future Together",
    description:
      "A collaborative platform where every Iranian can contribute to building a better future.",
    url: "/",
    locale: "en_US",
    alternateLocale: ["fa_IR"],
  },
  twitter: {
    card: "summary_large_image",
    title: "IranENovin — Build Iran's Future Together",
    description:
      "A collaborative platform where every Iranian can contribute to building a better future.",
  },
  icons: {
    icon: [{ url: "/brand/iranenovin_no_bg1_white_logo.png", type: "image/png" }],
    shortcut: "/brand/iranenovin_no_bg1_white_logo.png",
    apple: "/brand/iranenovin_no_bg1_white_logo.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#009B3A" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1419" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
