"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AuthModal from "@/components/auth/AuthModal";
import LocaleSwitcher from "./LocaleSwitcher";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { LionSunLogo } from "@/components/brand/LionSunLogo";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  is_read: 0 | 1;
  created_at: string;
}

function timeAgoShort(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setItems(data.notifications || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  // Poll every 2 minutes (was 60s). The bell updates optimistically on
  // markRead/markAllRead, and loads fresh when the dropdown opens.
  // Pause polling when the tab is hidden so backgrounded tabs don't hammer
  // the server.
  useEffect(() => {
    load();
    let iv: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (iv) return;
      iv = setInterval(load, 120_000);
    };
    const stop = () => {
      if (iv) { clearInterval(iv); iv = null; }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        load();
        start();
      } else {
        stop();
      }
    };
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open]);

  const markRead = async (id: string) => {
    // Optimistic update so the red badge clears immediately
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    const unread = items.filter((n) => !n.is_read);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: 1 as const })));
    await Promise.all(
      unread.map((n) =>
        fetch("/api/notifications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: n.id }),
        }).catch(() => { /* ignore */ })
      )
    );
  };

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);
  const badgeWidth = unreadCount > 9 ? "px-1 min-w-[20px]" : "w-5";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-iran-green/5"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-muted-foreground transition-colors hover:text-iran-green" />
          {unreadCount > 0 && (
            <span className={`absolute -top-0.5 -end-0.5 inline-flex h-5 items-center justify-center rounded-full bg-iran-red text-[11px] font-bold text-white shadow-iran-red ring-2 ring-white dark:ring-gray-950 ${badgeWidth}`}>
              {displayCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={(e) => { e.preventDefault(); markAllRead(); }}
              className="text-xs text-iran-green hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading && items.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              You&apos;re all caught up. No notifications yet.
            </div>
          )}
          {items.map((n) => {
            const body = (
              <div className={`flex gap-2 border-b border-border px-3 py-2.5 text-sm last:border-b-0 ${!n.is_read ? "bg-iran-green/5" : ""}`}>
                {!n.is_read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-iran-green" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`line-clamp-2 ${!n.is_read ? "font-semibold text-foreground" : "text-foreground/90"}`}>{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgoShort(n.created_at)}</p>
                </div>
              </div>
            );
            if (n.link_url) {
              return (
                <Link
                  key={n.id}
                  href={n.link_url as "/"}
                  onClick={() => { markRead(n.id); setOpen(false); }}
                  className="block hover:bg-muted/50"
                >
                  {body}
                </Link>
              );
            }
            return (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className="block w-full text-start hover:bg-muted/50"
              >
                {body}
              </button>
            );
          })}
        </div>
        <div className="border-t border-border px-3 py-2 text-center">
          <Link href="/profile" className="text-xs text-muted-foreground hover:text-iran-green" onClick={() => setOpen(false)}>
            View all in profile
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type NavLinkProps = {
  href: "/" | "/projects" | "/submit" | "/members" | "/invite";
  label: string;
  active: boolean;
};

function DesktopNavLink({ href, label, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-iran-green/5 ${
        active
          ? "text-iran-green dark:text-iran-bright-green"
          : "text-muted-foreground hover:text-iran-green dark:hover:text-iran-bright-green"
      }`}
    >
      {label}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-3 -bottom-0.5 h-[3px] rounded-full bg-gradient-to-r from-iran-green via-iran-gold to-iran-gold transition-opacity duration-200 ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
        }`}
      />
    </Link>
  );
}

export default function Navbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsProfileAttention, setNeedsProfileAttention] = useState(false);

  // Fetch admin status and profile completion from /api/auth/me (config-driven)
  useEffect(() => {
    if (!session?.user?.email) {
      setIsAdmin(false);
      setNeedsProfileAttention(false);
      return;
    }
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      setIsAdmin(!!d.isAdmin);
      setNeedsProfileAttention(!!d.needsProfileAttention);
    }).catch(() => {});
  }, [session?.user?.email]);

  const navLinks: { href: NavLinkProps["href"]; label: string }[] = [
    { href: "/", label: t("home") },
    { href: "/projects", label: t("projects") },
    { href: "/submit", label: t("submit") },
    { href: "/members", label: t("members") },
    { href: "/invite", label: t("invite") },
  ];

  // Home is only "active" when we're exactly at / (otherwise any path would match startsWith)
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-md dark:bg-gray-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            {/* Desktop: full size; Mobile: mini variant (auto via size) */}
            <span className="hidden md:inline-flex">
              <LionSunLogo size="lg" />
            </span>
            <span className="inline-flex md:hidden">
              <LionSunLogo size="md" variant="mini" />
            </span>
            <span className="truncate font-display text-base font-bold tracking-tight text-gradient-iran sm:text-lg">
              IranENovin
              <span className="hidden font-normal text-muted-foreground md:inline">
                {" "}
                <span aria-hidden="true">·</span>{" "}
              </span>
              <span
                className="hidden font-farsi text-base font-bold text-gradient-iran md:inline"
                dir="rtl"
              >
                ایران نوین
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <DesktopNavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={isActive(link.href)}
              />
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
            <div className="hidden items-center gap-2 md:flex">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
            {session && <NotificationBell />}
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative flex items-center gap-2 hover:bg-iran-green/5"
                  >
                    <Avatar className="h-7 w-7 ring-2 ring-iran-gold/30">
                      <AvatarImage src={session.user?.image || ""} />
                      <AvatarFallback className="bg-iran-green/10 text-iran-green">
                        {session.user?.name?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {needsProfileAttention && (
                      <span
                        aria-label="Complete your profile"
                        title="Complete your profile"
                        className="absolute -top-0.5 -end-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-iran-red text-[11px] font-bold text-white shadow-iran-red ring-2 ring-white dark:ring-gray-950"
                      >
                        !
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center justify-between gap-2">
                      <span>{t("profile")}</span>
                      {needsProfileAttention && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-iran-red" />
                      )}
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">Admin Panel</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => signOut()}>
                    {t("signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => setAuthOpen(true)}
                className="bg-iran-green text-white shadow-iran-green transition-all hover:bg-iran-deep-green hover:shadow-iran-gold"
                size="sm"
              >
                {t("signIn")}
              </Button>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-1 md:hidden">
            {/* LocaleSwitcher + ThemeToggle are hidden below sm and moved into
                the hamburger sheet to free up horizontal space at iPhone SE
                width. */}
            <div className="hidden items-center gap-1 sm:flex">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-iran-green/5"
                >
                  {mobileOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="mb-6 mt-8 flex items-center gap-2">
                  <LionSunLogo size="sm" />
                  <span className="font-display text-lg font-bold tracking-tight text-gradient-iran">
                    IranENovin
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      <span aria-hidden="true">·</span>{" "}
                    </span>
                    <span
                      className="font-farsi text-base font-bold text-gradient-iran"
                      dir="rtl"
                    >
                      ایران نوین
                    </span>
                  </span>
                </div>
                <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-iran-gold/50 to-transparent" />
                {/* xs-only row exposing Locale + Theme inside the sheet. On
                    >=sm they are already visible in the navbar chrome. */}
                <div className="mt-4 flex items-center gap-2 sm:hidden">
                  <LocaleSwitcher />
                  <ThemeToggle />
                </div>
                <div className="mt-6 flex flex-col gap-1.5">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive(link.href) ? "page" : undefined}
                      className={`rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${
                        isActive(link.href)
                          ? "bg-iran-green/10 text-iran-green dark:text-iran-bright-green"
                          : "text-foreground hover:bg-iran-green/5 hover:text-iran-green"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="mt-4 border-t pt-4">
                    {session ? (
                      <>
                        <div className="mb-3 flex items-center gap-2 px-3">
                          <Avatar className="h-8 w-8 ring-2 ring-iran-gold/30">
                            <AvatarImage src={session.user?.image || ""} />
                            <AvatarFallback className="bg-iran-green/10 text-iran-green">
                              {session.user?.name?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {session.user?.name}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => {
                            signOut();
                            setMobileOpen(false);
                          }}
                        >
                          {t("signOut")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        className="w-full bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green hover:shadow-iran-gold"
                        onClick={() => {
                          setMobileOpen(false);
                          setAuthOpen(true);
                        }}
                      >
                        {t("signIn")}
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        {/* Thin gold gradient divider below navbar */}
        <div
          aria-hidden="true"
          className="h-[2px] w-full bg-gradient-to-r from-transparent via-iran-gold/40 to-transparent"
        />
      </nav>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
