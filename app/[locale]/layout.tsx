import { Inter, Vazirmatn, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import Providers from "@/components/Providers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import JumpToTop from "@/components/layout/JumpToTop";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import SiteAnnouncementBanner from "@/components/layout/SiteAnnouncementBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as "en" | "fa")) {
    notFound();
  }

  const messages = await getMessages();
  const isRtl = locale === "fa";

  // Resolve the session server-side so SessionProvider starts with the real
  // authenticated state, not null — kills the "flash of signed-out" on
  // cold tab loads where the cookie is still valid.
  const session = await auth();

  // Inline theme init script (prevents FOUC by setting dark class before hydration)
  const themeInit = `(function(){try{var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      className={`${inter.variable} ${jakarta.variable} ${vazirmatn.variable}`}
      suppressHydrationWarning
    >
      <body
        className={`antialiased ${
          isRtl ? "font-farsi" : "font-sans"
        }`}
        style={{ lineHeight: isRtl ? "1.7" : "1.6" }}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <NextIntlClientProvider messages={messages}>
          <Providers session={session}>
            <div className="flex min-h-screen flex-col">
              <SiteAnnouncementBanner />
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <FeedbackButton />
            <JumpToTop />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
