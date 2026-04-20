import { NextResponse } from "next/server";

export async function GET() {
  // Import lazily to avoid circular deps
  const { isBotReady } = await import("@/lib/telegram/bot");
  const status = isBotReady();

  // Check webhook info from Telegram API
  let webhookInfo = null;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/getWebhookInfo`,
        { next: { revalidate: 0 } }
      );
      if (res.ok) {
        const data = await res.json();
        webhookInfo = data.result || null;
      }
    } catch { /* ignore */ }
  }

  // Check bot info
  let botInfo = null;
  if (token) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/getMe`,
        { next: { revalidate: 0 } }
      );
      if (res.ok) {
        const data = await res.json();
        botInfo = data.result || null;
      }
    } catch { /* ignore */ }
  }

  const healthy = status.initialized;

  return NextResponse.json({
    ok: healthy,
    bot: {
      ...status,
      username: botInfo?.username || null,
      firstName: botInfo?.first_name || null,
    },
    webhook: webhookInfo ? {
      url: webhookInfo.url || '',
      hasCustomCertificate: webhookInfo.has_custom_certificate,
      pendingUpdateCount: webhookInfo.pending_update_count,
      lastErrorDate: webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000).toISOString() : null,
      lastErrorMessage: webhookInfo.last_error_message || null,
    } : null,
    config: {
      tokenSet: !!token,
      channelId: process.env.TELEGRAM_CHANNEL_ID || null,
      adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || null,
    },
    timestamp: new Date().toISOString(),
  }, {
    status: healthy ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
