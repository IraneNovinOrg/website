export function getTelegramLink(username: string, startParam?: string): string {
  if (typeof window === "undefined") {
    // Server-side: always use https
    const base = `https://t.me/${username}`;
    return startParam ? `${base}?start=${startParam}` : base;
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // On mobile: use tg:// protocol to open the native app directly
    const base = `tg://resolve?domain=${username}`;
    return startParam ? `${base}&start=${startParam}` : base;
  }

  // On desktop: use https://t.me/ (opens web or desktop app)
  const base = `https://t.me/${username}`;
  return startParam ? `${base}?start=${startParam}` : base;
}

export function getTelegramChannelLink(username: string): string {
  if (typeof window === "undefined") return `https://t.me/${username}`;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isMobile ? `tg://resolve?domain=${username}` : `https://t.me/${username}`;
}
