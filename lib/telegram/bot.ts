/* eslint-disable @typescript-eslint/no-explicit-any */
import { Telegraf, Markup } from "telegraf";
import { getDb } from "../db/index";

let bot: Telegraf | null = null;

export function getBot(): Telegraf | null {
  if (bot) return bot;
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;

  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  // ─── /start ──────────────────────────────────────────────

  bot.command("start", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const payload = ctx.message.text.split(" ")[1];

    // ─── Website sign-in flow ("login via link/QR") ─────────────────────
    // Payload shape: login_<token>. We show an inline confirm so an
    // attacker who steals the URL can't sign in without the real user's
    // active Telegram session tapping YES.
    if (payload?.startsWith("login_")) {
      const token = payload.replace("login_", "");
      const { getLoginSession } = await import("./login-session");
      const session = getLoginSession(token);
      if (!session || session.status === "expired") {
        await ctx.reply(
          "⌛ That sign-in link has expired. Click the Telegram button on the website again to get a fresh one."
        );
        return;
      }
      if (session.status !== "pending") {
        await ctx.reply(
          "This sign-in link has already been used. Head back to the website — you should already be signed in."
        );
        return;
      }
      const from = ctx.from!;
      const displayName =
        [from.first_name, from.last_name].filter(Boolean).join(" ") ||
        from.username ||
        "this account";
      await ctx.reply(
        `👋 Hi ${displayName}!\n\nSomeone is trying to sign in to IranENovin with your Telegram account. If that's you, tap Yes below.`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Yes, sign me in", `login_yes:${token}`),
            Markup.button.callback("❌ Not me", `login_no:${token}`),
          ],
        ])
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingUser = getDb()
      .prepare("SELECT name FROM users WHERE telegram_chat_id = ?")
      .get(chatId) as any;

    if (existingUser) {
      await ctx.reply(
        `Welcome back, ${existingUser.name || "friend"}! 👋\n\n` +
          "Use /tasks to see your open tasks, or /projects for your projects."
      );
      return;
    }

    if (payload?.startsWith("link_")) {
      const token = payload.replace("link_", "");
      const result = verifyAndConsumeLinkToken(token);
      if (result && result.telegramChatId === chatId) {
        // Token is valid — the website side handles the actual linking
        await ctx.reply(
          "✅ Token verified! Now open the link on the website to complete linking.\n\n" +
            "What would you like to hear about?",
          Markup.inlineKeyboard([
            [Markup.button.callback("📋 Task matches", "pref_tasks")],
            [Markup.button.callback("📝 Review requests", "pref_reviews")],
            [Markup.button.callback("📰 Weekly digest", "pref_digest")],
            [Markup.button.callback("🔔 Everything", "pref_all")],
          ])
        );
        return;
      }
    }

    await ctx.reply(
      "🌟 *Welcome to IranENovin\\!*\n\n" +
        "We're a community of Iranians building the future — together\\.\n\n" +
        "Right now I can:\n" +
        "• Keep you updated on ideas and projects\n" +
        "• Notify you when something matches your skills\n" +
        "• Let you review submissions from your phone\n\n" +
        "_Coming soon: submit ideas and vote directly from Telegram_",
      {
        parse_mode: "MarkdownV2",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔗 Link my account", "action_link")],
          [Markup.button.url("🌐 Visit website", "https://iranenovin.com")],
          [Markup.button.callback("📢 Just keep me updated", "action_subscribe")],
        ]),
      }
    );
  });

  // ─── Website sign-in confirm / deny callbacks ─────────────

  bot.action(/login_yes:(.+)/, async (ctx) => {
    const token = ctx.match[1];
    const from = ctx.from!;
    const { confirmLoginSession } = await import("./login-session");

    // Best-effort fetch of the user's profile photo so the web side can show
    // their avatar instantly — never fatal if Telegram doesn't serve it.
    let photoUrl: string | null = null;
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(from.id, 0, 1);
      const fileId = photos?.photos?.[0]?.[0]?.file_id;
      if (fileId) {
        const file = await ctx.telegram.getFile(fileId);
        if (file.file_path && process.env.TELEGRAM_BOT_TOKEN) {
          photoUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        }
      }
    } catch {
      /* photo is optional */
    }

    const res = confirmLoginSession(token, {
      chatId: from.id.toString(),
      username: from.username || null,
      firstName: from.first_name || null,
      lastName: from.last_name || null,
      photoUrl,
    });

    await ctx.answerCbQuery(res.ok ? "Signing you in…" : "Could not confirm");
    if (res.ok) {
      await ctx.editMessageText(
        "✅ Signed in — you can return to IranENovin. This tab will refresh automatically."
      );
    } else if (res.reason === "expired") {
      await ctx.editMessageText(
        "⌛ That sign-in request expired. Click the Telegram button on the website again."
      );
    } else if (res.reason === "already_confirmed") {
      await ctx.editMessageText("This sign-in was already confirmed. ✅");
    } else {
      await ctx.editMessageText("Couldn't find that sign-in request.");
    }
  });

  bot.action(/login_no:(.+)/, async (ctx) => {
    await ctx.answerCbQuery("Sign-in cancelled");
    await ctx.editMessageText(
      "Okay — no sign-in started. If this wasn't you, someone may have shared your link. Delete the message and carry on."
    );
  });

  // ─── Link flow ───────────────────────────────────────────

  bot.action("action_link", async (ctx) => {
    await ctx.answerCbQuery();
    const token = generateLinkToken(
      ctx.from!.id.toString(),
      ctx.from!.username || null
    );
    await ctx.reply(
      "🔗 Open this link to connect your accounts:\n\n" +
        `https://iranenovin.com/en/profile?linkTelegram=${token}\n\n` +
        "This link expires in 10 minutes."
    );
  });

  bot.action("action_subscribe", async (ctx) => {
    await ctx.answerCbQuery();
    getDb()
      .prepare("INSERT OR IGNORE INTO telegram_subscribers (chat_id, username) VALUES (?, ?)")
      .run(ctx.from!.id.toString(), ctx.from!.username || null);

    await ctx.reply(
      "📢 Got it! I'll send you weekly highlights.\n\n" +
        "You can link your account anytime with /link to get personalized notifications."
    );
  });

  // ─── Preferences ─────────────────────────────────────────

  bot.action(/pref_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const pref = ctx.match[1];
    const chatId = ctx.from!.id.toString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = getDb()
      .prepare("SELECT id, notification_prefs FROM users WHERE telegram_chat_id = ?")
      .get(chatId) as any;
    if (!user) return;

    const prefs = JSON.parse(user.notification_prefs || "{}");

    if (pref === "all") {
      Object.assign(prefs, {
        taskMatches: true, expertReviews: true,
        projectUpdates: true, weeklyDigest: true, channel: "telegram",
      });
    } else {
      const map: Record<string, string> = {
        tasks: "taskMatches", reviews: "expertReviews",
        digest: "weeklyDigest",
      };
      if (map[pref]) { prefs[map[pref]] = true; prefs.channel = "telegram"; }
    }

    getDb()
      .prepare("UPDATE users SET notification_prefs = ? WHERE id = ?")
      .run(JSON.stringify(prefs), user.id);

    await ctx.reply("✅ Preferences saved! Change them anytime with /settings");
  });

  // ─── /link ───────────────────────────────────────────────

  bot.command("link", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = getDb()
      .prepare("SELECT name FROM users WHERE telegram_chat_id = ?")
      .get(chatId) as any;

    if (existing) {
      await ctx.reply(`You're already linked as ${existing.name}! ✅`);
      return;
    }

    const token = generateLinkToken(ctx.from.id.toString(), ctx.from.username || null);
    await ctx.reply(
      "🔗 Open this link to connect:\n\n" +
        `https://iranenovin.com/en/profile?linkTelegram=${token}`
    );
  });

  // ─── /ideas ──────────────────────────────────────────────

  bot.command("ideas", async (ctx) => {
    const ideas = getTopIdeas(5);
    if (ideas.length === 0) {
      await ctx.reply("No trending ideas right now. Check iranenovin.com/ideas");
      return;
    }

    let text = "🔥 Trending Ideas\n\n";
    for (const idea of ideas) {
      text += `👍 ${idea.voteCount} — ${idea.title}\n`;
      text += `   ${idea.category} · ${idea.commentCount} comments\n`;
      text += `   https://iranenovin.com/en/ideas/${idea.id}\n\n`;
    }
    await ctx.reply(text);
  });

  // ─── /projects ───────────────────────────────────────────

  bot.command("projects", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = getDb()
      .prepare("SELECT id FROM users WHERE telegram_chat_id = ?")
      .get(chatId) as any;

    if (!user) { await ctx.reply("Link your account first with /link"); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projects = getDb().prepare(
      "SELECT title, status, slug FROM projects WHERE lead_user_id = ? LIMIT 10"
    ).all(user.id) as any[];

    if (projects.length === 0) {
      await ctx.reply("You're not leading any projects yet.\nBrowse ideas at iranenovin.com/ideas!");
      return;
    }

    let text = "📋 Your Projects\n\n";
    for (const p of projects) {
      const e = p.status === "active" ? "🟢" : "🟡";
      text += `${e} ${p.title}\n   https://iranenovin.com/en/projects/${p.slug}\n\n`;
    }
    await ctx.reply(text);
  });

  // ─── /tasks ──────────────────────────────────────────────

  bot.command("tasks", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = getDb()
      .prepare("SELECT id FROM users WHERE telegram_chat_id = ?")
      .get(chatId) as any;

    if (!user) { await ctx.reply("Link your account first with /link"); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks = getDb().prepare(
      `SELECT id, title, status, due_date, time_estimate FROM tasks
       WHERE assignee_id = ? AND status IN ('claimed','in-progress')
       ORDER BY due_date ASC LIMIT 10`
    ).all(user.id) as any[];

    if (tasks.length === 0) {
      await ctx.reply("No open tasks. Check /ideas for things you can help with!");
      return;
    }

    for (const t of tasks) {
      const due = t.due_date ? `Due: ${t.due_date.split("T")[0]}` : "No deadline";
      await ctx.reply(
        `📌 ${t.title}\n⏱ ${t.time_estimate || "~2-4 hours"} · ${due}\nStatus: ${t.status}`,
        Markup.inlineKeyboard([
          [Markup.button.url("Open task", `https://iranenovin.com/en/tasks/${t.id}`)],
        ])
      );
    }
  });

  // ─── /settings ───────────────────────────────────────────

  bot.command("settings", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = getDb()
      .prepare("SELECT notification_prefs FROM users WHERE telegram_chat_id = ?")
      .get(chatId) as any;

    if (!user) { await ctx.reply("Link your account first with /link"); return; }

    const prefs = JSON.parse(user.notification_prefs || "{}");
    await sendSettingsMessage(ctx, prefs);
  });

  bot.action(/toggle_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const field = ctx.match[1];
    const chatId = ctx.from!.id.toString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = getDb()
      .prepare("SELECT id, notification_prefs FROM users WHERE telegram_chat_id = ?")
      .get(chatId) as any;
    if (!user) return;

    const prefs = JSON.parse(user.notification_prefs || "{}");
    prefs[field] = !prefs[field];
    prefs.channel = "telegram";

    getDb().prepare("UPDATE users SET notification_prefs = ? WHERE id = ?").run(
      JSON.stringify(prefs), user.id
    );

    await sendSettingsMessage(ctx, prefs, true);
  });

  // ─── Expert review callbacks ─────────────────────────────

  bot.action(/review_approve:(.+)/, async (ctx) => {
    await ctx.answerCbQuery("✅ Approved!");
    const submissionId = ctx.match[1];
    const chatId = ctx.from!.id.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = getDb()
      .prepare("SELECT id, name FROM users WHERE telegram_chat_id = ?")
      .get(chatId) as any;

    getDb().prepare(
      `INSERT INTO expert_reviews (id, submission_id, reviewer_id, reviewer_name, decision, via)
       VALUES (?, ?, ?, ?, 'approve', 'telegram')`
    ).run(genId("rev"), submissionId, user?.id || `tg-${chatId}`, user?.name || "Telegram user");

    await ctx.reply("Thank you for reviewing! Your approval has been recorded. ✅");
  });

  bot.action(/review_reject:(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const submissionId = ctx.match[1];
    const chatId = ctx.from!.id.toString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = getDb()
      .prepare("SELECT id FROM users WHERE telegram_chat_id = ?")
      .get(chatId) as any;

    pendingActions.set(chatId, {
      type: "reject_reason", submissionId,
      userId: user?.id || `tg-${chatId}`,
    });
    await ctx.reply("Please reply with your reason for rejection:");
  });

  // ─── /help ───────────────────────────────────────────────

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "🤖 IranENovin Bot Help\n\n" +
        "/start — Welcome message\n" +
        "/link — Link your iranenovin.com account\n" +
        "/ideas — See trending ideas\n" +
        "/projects — Your active projects\n" +
        "/tasks — Your open tasks\n" +
        "/settings — Notification preferences\n" +
        "/help — This message\n\n" +
        "📱 Full platform: iranenovin.com"
    );
  });

  // ─── Fallback text handler ───────────────────────────────

  bot.on("text", async (ctx) => {
    const chatId = ctx.from.id.toString();
    const pending = pendingActions.get(chatId);

    if (pending?.type === "reject_reason") {
      getDb().prepare(
        `INSERT INTO expert_reviews (id, submission_id, reviewer_id, decision, comment, via)
         VALUES (?, ?, ?, 'reject', ?, 'telegram')`
      ).run(genId("rev"), pending.submissionId, pending.userId, ctx.message.text);

      pendingActions.delete(chatId);
      await ctx.reply("❌ Rejection recorded with your feedback. Thank you!");
      return;
    }

    await ctx.reply(
      "I'm not sure what you mean. Try /help to see what I can do."
    );
  });

  return bot;
}

// ─── Settings message ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendSettingsMessage(ctx: any, prefs: Record<string, boolean>, isEdit = false) {
  const s = (on: boolean) => (on ? "✅" : "❌");
  const text =
    "⚙️ Notification Settings\n\n" +
    `${s(prefs.taskMatches)} Task matches (skills-based)\n` +
    `${s(prefs.expertReviews)} Expert review requests\n` +
    `${s(prefs.projectUpdates)} Project updates\n` +
    `${s(prefs.weeklyDigest)} Weekly digest\n\n` +
    "Tap to toggle:";

  const kb = Markup.inlineKeyboard([
    [
      Markup.button.callback(`${prefs.taskMatches ? "🔕" : "🔔"} Tasks`, "toggle_taskMatches"),
      Markup.button.callback(`${prefs.expertReviews ? "🔕" : "🔔"} Reviews`, "toggle_expertReviews"),
    ],
    [
      Markup.button.callback(`${prefs.projectUpdates ? "🔕" : "🔔"} Updates`, "toggle_projectUpdates"),
      Markup.button.callback(`${prefs.weeklyDigest ? "🔕" : "🔔"} Digest`, "toggle_weeklyDigest"),
    ],
    [Markup.button.callback("🔔 All on", "pref_all")],
  ]);

  if (isEdit) {
    await ctx.editMessageText(text, kb);
  } else {
    await ctx.reply(text, kb);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function genId(prefix = ""): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return prefix ? `${prefix}-${id}` : id;
}

const pendingActions = new Map<string, { type: string; submissionId: string; userId: string }>();

export function generateLinkToken(telegramChatId: string, username: string | null): string {
  const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  getDb().prepare(
    "INSERT OR REPLACE INTO telegram_link_tokens (token, telegram_chat_id, telegram_username) VALUES (?, ?, ?)"
  ).run(token, telegramChatId, username);
  return token;
}

export function verifyAndConsumeLinkToken(token: string): {
  telegramChatId: string;
  telegramUsername: string | null;
} | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = getDb().prepare(
    "SELECT telegram_chat_id, telegram_username FROM telegram_link_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
  ).get(token) as any;

  if (!row) return null;
  getDb().prepare("UPDATE telegram_link_tokens SET used = 1 WHERE token = ?").run(token);
  return { telegramChatId: row.telegram_chat_id, telegramUsername: row.telegram_username };
}

export function getTelegramChatId(userId: string): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = getDb().prepare(
    "SELECT telegram_chat_id FROM users WHERE id = ? AND telegram_chat_id IS NOT NULL"
  ).get(userId) as any;
  return row?.telegram_chat_id || null;
}

function getTopIdeas(count: number) {
  try {
    const rows = getDb()
      .prepare(
        `SELECT id, title, category, github_vote_count AS voteCount, comment_count AS commentCount
         FROM ideas
         ORDER BY github_vote_count DESC
         LIMIT ?`
      )
      .all(count) as Array<{
        id: string;
        title: string;
        category: string;
        voteCount: number;
        commentCount: number;
      }>;
    return rows;
  } catch { return []; }
}

// ─── Bot Initialization ────────────────────────────────────────────────────

let botInitialized = false;
let botMode: 'webhook' | 'polling' | 'none' = 'none';
let botWebhookUrl: string | undefined;

export async function initializeBot(): Promise<void> {
  const b = getBot();
  if (!b) {
    console.warn('[Telegram] No TELEGRAM_BOT_TOKEN — bot disabled');
    return;
  }

  // Register command menu so users see commands in Telegram UI
  try {
    await b.telegram.setMyCommands([
      { command: 'start', description: 'Welcome & get started' },
      { command: 'link', description: 'Link your iranenovin.com account' },
      { command: 'ideas', description: 'See trending ideas' },
      { command: 'projects', description: 'Your active projects' },
      { command: 'tasks', description: 'Your open tasks' },
      { command: 'settings', description: 'Notification preferences' },
      { command: 'help', description: 'Show available commands' },
    ]);
    console.log('[Telegram] Command menu registered');
  } catch (e) {
    console.error('[Telegram] Failed to register commands:', e);
  }

  // Webhook mode needs a *public* HTTPS endpoint — Telegram rejects http
  // and rejects localhost. We only flip to webhook when:
  //  1. We're running on a real deployment (NODE_ENV=production OR VERCEL), AND
  //  2. There's an https URL available, AND
  //  3. The URL isn't localhost.
  // Otherwise fall back to long polling so the bot actually answers /start.
  const envUrl =
    process.env.TELEGRAM_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  const canUseWebhook =
    isProd &&
    !!envUrl &&
    envUrl.startsWith("https://") &&
    !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(envUrl);

  // Explicit opt-out knob: `TELEGRAM_USE_POLLING=1` forces polling no matter
  // what, handy on local prod-mode runs (`pnpm start`) behind a Cloudflare
  // tunnel where the external URL is https but the instance is still one
  // machine that should poll.
  const forcePolling = process.env.TELEGRAM_USE_POLLING === "1";

  if (canUseWebhook && !forcePolling) {
    botWebhookUrl = `${envUrl!.replace(/\/$/, "")}/api/telegram/webhook`;
    try {
      await b.telegram.setWebhook(botWebhookUrl);
      botMode = "webhook";
      botInitialized = true;
      console.log(`[Telegram] Webhook set: ${botWebhookUrl}`);
      return;
    } catch (e) {
      console.error(
        "[Telegram] Failed to set webhook — falling back to long polling:",
        (e as Error).message
      );
      // fall through to polling
    }
  } else if (isProd && envUrl && !envUrl.startsWith("https://")) {
    console.warn(
      `[Telegram] NEXT_PUBLIC_APP_URL=${envUrl} is not https — using long polling instead of webhook.`
    );
  }

  // Polling mode — works from any machine, no public URL needed.
  try {
    await b.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
    // bot.launch() resolves when bot.stop() is called. Don't await.
    b.launch().catch((e) => {
      console.error("[Telegram] Polling error:", (e as Error).message);
    });
    botMode = "polling";
    botInitialized = true;
    console.log("[Telegram] Long polling started");

    const stop = () => { try { b.stop(); } catch { /* noop */ } };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch (e) {
    console.error("[Telegram] Failed to start polling:", (e as Error).message);
  }
}

export function isBotReady(): { initialized: boolean; mode: string; webhookUrl?: string } {
  return { initialized: botInitialized, mode: botMode, webhookUrl: botWebhookUrl };
}
