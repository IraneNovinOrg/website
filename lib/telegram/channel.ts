/**
 * Telegram Channel Posting Module
 *
 * Posts platform updates to the @iranenovin0 Telegram channel.
 * All functions are fire-and-forget: they catch their own errors and return boolean.
 * Uses HTML parse_mode and bilingual formatting (EN + FA).
 * Calls the Telegram Bot API directly via fetch (no Telegraf import).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const PLATFORM_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://iranenovin.com';

function getChannelId(): string | null {
  return process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || null;
}

function getAdminChatId(): string | null {
  return process.env.TELEGRAM_ADMIN_CHAT_ID || null;
}

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendChannelMessage(
  html: string,
  buttons?: { text: string; url: string }[][],
  chatIdOverride?: string
): Promise<boolean> {
  const token = getBotToken();
  const chatId = chatIdOverride || getChannelId();
  if (!token || !chatId) return false;

  try {
    const body: any = {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (buttons?.length) {
      body.reply_markup = {
        inline_keyboard: buttons.map(row =>
          row.map(b => ({ text: b.text, url: b.url }))
        ),
      };
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Telegram Channel] Send failed:', err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Telegram Channel] Error:', e);
    return false;
  }
}

// ─── Public Functions ────────────────────────────────────────────────────────

export async function postNewIdea(idea: {
  id: string;
  title: string;
  category: string;
  authorName: string;
  bodyPreview: string;
}): Promise<boolean> {
  const title = escapeHtml(idea.title);
  const category = escapeHtml(idea.category);
  const author = escapeHtml(idea.authorName);
  const preview = escapeHtml(idea.bodyPreview);

  const html =
    `\u{1F4A1} <b>New Idea Submitted</b>\n\n` +
    `<b>${title}</b>\n` +
    `\u{1F4C2} ${category} | by ${author}\n\n` +
    `${preview}...\n\n` +
    `\u{2500}\u{2500}\u{2500}\n` +
    `\u{1F1EE}\u{1F1F7} <b>\u0627\u06CC\u062F\u0647 \u062C\u062F\u06CC\u062F \u0627\u0631\u0633\u0627\u0644 \u0634\u062F</b>\n` +
    `\u00AB${title}\u00BB`;

  return sendChannelMessage(html, [
    [
      { text: '\u{1F517} View Idea', url: `${PLATFORM_URL}/en/ideas/${idea.id}` },
      { text: '\u{1F4E2} Join Channel', url: 'https://t.me/iranenovin0' },
    ],
  ]);
}

export async function postIdeaMilestone(idea: {
  id: string;
  title: string;
  voteCount: number;
  milestone: string;
}): Promise<boolean> {
  const title = escapeHtml(idea.title);
  const milestone = escapeHtml(idea.milestone);

  const html =
    `\u{1F3AF} <b>Milestone Reached!</b>\n\n` +
    `<b>${title}</b>\n` +
    `\u{1F5F3} ${idea.voteCount} votes \u{2014} ${milestone}\n\n` +
    `\u{2500}\u{2500}\u{2500}\n` +
    `\u{1F1EE}\u{1F1F7} <b>\u0646\u0642\u0637\u0647 \u0639\u0637\u0641!</b>\n` +
    `\u00AB${title}\u00BB \u0628\u0647 ${idea.voteCount} \u0631\u0623\u06CC \u0631\u0633\u06CC\u062F!`;

  return sendChannelMessage(html, [
    [{ text: '\u{1F517} View Project', url: `${PLATFORM_URL}/en/ideas/${idea.id}` }],
  ]);
}

export async function postProjectUpdate(project: {
  id: string;
  title: string;
  updateType: string;
  detail: string;
}): Promise<boolean> {
  const title = escapeHtml(project.title);
  const updateType = escapeHtml(project.updateType);
  const detail = escapeHtml(project.detail);

  const html =
    `\u{1F4CB} <b>Project Update</b>\n\n` +
    `<b>${title}</b>\n` +
    `${updateType}: ${detail}\n\n` +
    `\u{2500}\u{2500}\u{2500}\n` +
    `\u{1F1EE}\u{1F1F7} <b>\u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u067E\u0631\u0648\u0698\u0647</b>\n` +
    `\u00AB${title}\u00BB`;

  return sendChannelMessage(html, [
    [{ text: '\u{1F517} View Project', url: `${PLATFORM_URL}/en/ideas/${project.id}` }],
  ]);
}

export async function postWeeklyDigest(digest: {
  totalIdeas: number;
  newIdeas: number;
  activeProjects: number;
  tasksCompleted: number;
  newContributors: number;
  topIdea?: string;
}): Promise<boolean> {
  const topLine = digest.topIdea
    ? `\n\u{1F31F} Top idea: <b>${escapeHtml(digest.topIdea)}</b>\n`
    : '';

  const html =
    `\u{1F4F0} <b>Weekly Community Digest</b>\n\n` +
    `\u{1F4CA} <b>This Week's Numbers:</b>\n` +
    `\u{2022} ${digest.newIdeas} new ideas submitted\n` +
    `\u{2022} ${digest.activeProjects} active projects\n` +
    `\u{2022} ${digest.tasksCompleted} tasks completed\n` +
    `\u{2022} ${digest.newContributors} new contributors\n` +
    `\u{2022} ${digest.totalIdeas} total ideas\n` +
    topLine + `\n` +
    `\u{2500}\u{2500}\u{2500}\n` +
    `\u{1F1EE}\u{1F1F7} <b>\u062E\u0644\u0627\u0635\u0647 \u0647\u0641\u062A\u06AF\u06CC</b>\n` +
    `\u{2022} ${digest.newIdeas} \u0627\u06CC\u062F\u0647 \u062C\u062F\u06CC\u062F\n` +
    `\u{2022} ${digest.activeProjects} \u067E\u0631\u0648\u0698\u0647 \u0641\u0639\u0627\u0644\n` +
    `\u{2022} ${digest.tasksCompleted} \u0648\u0638\u06CC\u0641\u0647 \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F\u0647`;

  return sendChannelMessage(html, [
    [
      { text: '\u{1F310} Visit Platform', url: PLATFORM_URL },
      { text: '\u{1F4E2} Join Us', url: 'https://t.me/iranenovin0' },
    ],
  ]);
}

export async function postNewContributors(
  contributors: { name: string }[]
): Promise<boolean> {
  if (!contributors.length) return false;

  const count = contributors.length;
  const list = contributors
    .map(c => `\u{2022} ${escapeHtml(c.name)}`)
    .join('\n');

  const html =
    `\u{1F44B} <b>Welcome New Contributors!</b>\n\n` +
    `${count} new member${count !== 1 ? 's' : ''} joined this week:\n` +
    `${list}\n\n` +
    `\u{2500}\u{2500}\u{2500}\n` +
    `\u{1F1EE}\u{1F1F7} <b>\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F!</b>\n` +
    `${count} \u0639\u0636\u0648 \u062C\u062F\u06CC\u062F \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647 \u067E\u06CC\u0648\u0633\u062A\u0646\u062F`;

  return sendChannelMessage(html, [
    [{ text: '\u{1F91D} Join the Community', url: PLATFORM_URL }],
  ]);
}

export async function postAdminAlert(
  message: string,
  context?: string
): Promise<boolean> {
  const adminChatId = getAdminChatId();
  if (!adminChatId) return false;

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const contextLine = context ? `\n\n${escapeHtml(context)}` : '';

  const html =
    `\u{26A0}\u{FE0F} <b>Admin Alert</b>\n\n` +
    `${escapeHtml(message)}` +
    contextLine +
    `\n\n\u{1F550} ${timestamp}`;

  // Send to admin chat specifically, not the public channel
  return sendChannelMessage(html, undefined, adminChatId);
}
