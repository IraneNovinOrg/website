/**
 * Admin Configuration — Single Source of Truth
 * ─────────────────────────────────────────────
 * All admin-email checks MUST go through this module. Never hardcode
 * admin emails in routes or components; use `isAdmin(session.user.email)`.
 *
 * Source of truth: `_config/ai.json` → `adminEmails` array.
 * Admins can add/remove other admins via the admin panel (see POST/DELETE helpers).
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), "_config", "ai.json");

let cachedEmails: string[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000; // invalidate after 30s — keeps hot-path fast, changes visible quickly

function loadConfig(): { adminEmails: string[]; [k: string]: unknown } {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

function refreshCache(): string[] {
  try {
    const cfg = loadConfig();
    const emails = Array.isArray(cfg.adminEmails) ? cfg.adminEmails.map((e: string) => e.toLowerCase().trim()) : [];
    cachedEmails = emails;
    cachedAt = Date.now();
    return emails;
  } catch {
    cachedEmails = cachedEmails || [];
    return cachedEmails;
  }
}

/** Returns true if the given email is in the admin list. Case-insensitive. */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const now = Date.now();
  if (!cachedEmails || now - cachedAt > CACHE_TTL_MS) {
    refreshCache();
  }
  if (cachedEmails!.includes(normalized)) return true;
  // Also accept a prefixed form for non-email identifiers:
  //   github:<login>    — when the user signed in via GitHub and the admin
  //                       list stores the login (e.g. "github:omid").
  //   telegram:<chatId> — when the user is Telegram-only (synthetic email).
  // Callers should use `isAdminAny()` for multi-identifier checks.
  return false;
}

/**
 * True if ANY of the given identifiers matches the admin list. Use this on
 * the server-side admin-gate paths so a user who signed in via Telegram
 * (synthetic email) or GitHub (no verified email) can still be granted
 * admin rights as long as one of their linked identifiers is whitelisted.
 *
 * Accepted identifier forms in `_config/ai.json → adminEmails`:
 *   • plain email
 *   • "github:<login>"
 *   • "telegram:<chat_id>"
 */
export function isAdminAny(identifiers: {
  email?: string | null;
  githubLogin?: string | null;
  telegramChatId?: string | null;
  telegramHandle?: string | null;
}): boolean {
  if (!cachedEmails || Date.now() - cachedAt > CACHE_TTL_MS) refreshCache();
  const list = cachedEmails!;
  const check = (v: string | null | undefined) =>
    !!v && list.includes(v.toLowerCase().trim());
  if (check(identifiers.email)) return true;
  if (check(`github:${identifiers.githubLogin}`)) return true;
  if (check(`telegram:${identifiers.telegramChatId}`)) return true;
  if (check(`telegram:@${identifiers.telegramHandle}`)) return true;
  return false;
}

/** Returns the full list of admin emails (read from config). */
export function listAdmins(): string[] {
  if (!cachedEmails || Date.now() - cachedAt > CACHE_TTL_MS) refreshCache();
  return [...(cachedEmails || [])];
}

/** Adds an admin email to the config. Returns true if added, false if already present. */
export function addAdmin(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  if (!normalized || !/@/.test(normalized)) throw new Error("Invalid email");
  const cfg = loadConfig();
  const current: string[] = Array.isArray(cfg.adminEmails) ? cfg.adminEmails : [];
  if (current.map((e) => e.toLowerCase().trim()).includes(normalized)) return false;
  cfg.adminEmails = [...current, normalized];
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
  cachedEmails = null; // invalidate
  return true;
}

/** Removes an admin email from the config. Returns true if removed. */
export function removeAdmin(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  const cfg = loadConfig();
  const current: string[] = Array.isArray(cfg.adminEmails) ? cfg.adminEmails : [];
  const filtered = current.filter((e) => e.toLowerCase().trim() !== normalized);
  if (filtered.length === current.length) return false;
  cfg.adminEmails = filtered;
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
  cachedEmails = null;
  return true;
}

/** Force-refresh the admin cache (e.g., after external config change). */
export function invalidateAdminCache(): void {
  cachedEmails = null;
}
