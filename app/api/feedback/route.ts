/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, logActivity } from "@/lib/db/index";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { limitOrRespond } from "@/lib/rate-limit";

/** Allowed MIME types for feedback attachments */
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

/** Image MIME types (sent as photos to Telegram) */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 3;

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(request: NextRequest) {
  const session = await auth();

  const rlUserId =
    (session?.user as { id?: string } | undefined)?.id ||
    session?.user?.email ||
    null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 10,
    windowMs: 60 * 60 * 1000,
    bucket: "feedback",
  });
  if (limited) return limited;

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const type = (formData.get("type") as string) || "general";
  const message = (formData.get("message") as string) || "";
  const url = (formData.get("url") as string) || null;

  if (!message || message.trim().length < 10) {
    return NextResponse.json(
      { error: "Feedback must be at least 10 characters" },
      { status: 400 }
    );
  }

  // Process file attachments
  const files: File[] = [];
  for (const entry of formData.getAll("files")) {
    if (entry instanceof File && entry.size > 0) {
      files.push(entry);
    }
  }

  // Validate files
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files allowed` },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 5MB limit` },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed. Use PNG, JPG, GIF, WebP, or PDF.` },
        { status: 400 }
      );
    }
  }

  // Save files to disk
  const uploadDir = join(process.cwd(), "public", "uploads", "feedback");
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  const attachments: { name: string; path: string; type: string; size: number }[] = [];
  const fileBuffers: { buffer: Buffer; name: string; type: string }[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop() || "bin";
    const savedName = `${genId()}.${ext}`;
    const savePath = join(uploadDir, savedName);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    writeFileSync(savePath, buffer);
    attachments.push({
      name: file.name,
      path: `/uploads/feedback/${savedName}`,
      type: file.type,
      size: file.size,
    });
    fileBuffers.push({ buffer, name: file.name, type: file.type });
  }

  // Store in database
  const db = getDb();
  const id = genId();
  const userEmail = session?.user?.email || "anonymous";
  const userName = session?.user?.name || "Anonymous";

  db.prepare(
    `INSERT INTO feedback (id, user_email, user_name, type, message, url, attachments, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    userEmail,
    userName,
    type,
    message.trim(),
    url,
    JSON.stringify(attachments)
  );

  logActivity({
    eventType: "feedback_submitted",
    actorName: userName,
    details: `${type}: ${message.trim().slice(0, 100)}${attachments.length ? ` [${attachments.length} file(s)]` : ""}`,
  });

  // Send to Telegram channel (fire-and-forget, never blocks the response)
  const chatId =
    process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (chatId) {
    (async () => {
      try {
        const {
          sendFeedbackMessage,
          sendFeedbackPhoto,
          sendFeedbackDocument,
        } = await import("@/lib/telegram/notify");

        // Build the text message
        const typeEmoji =
          type === "bug" ? "🐛" : type === "feature" ? "💡" : "💬";
        const typeLabel =
          type === "bug"
            ? "Bug Report"
            : type === "feature"
              ? "Feature Request"
              : "General Feedback";
        const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

        let text = `${typeEmoji} <b>${typeLabel}</b>\n\n`;
        text += `<b>From:</b> ${escapeHtml(userName)}`;
        if (userEmail && userEmail !== "anonymous") {
          text += ` (${escapeHtml(userEmail)})`;
        }
        text += `\n`;
        if (url) {
          text += `<b>Page:</b> ${escapeHtml(url)}\n`;
        }
        text += `<b>Time:</b> ${timestamp} UTC\n\n`;
        text += escapeHtml(message.trim().slice(0, 3000));
        if (attachments.length > 0) {
          text += `\n\n📎 <i>${attachments.length} attachment(s)</i>`;
        }

        await sendFeedbackMessage(chatId, text);

        // Send each file attachment to Telegram
        for (const fb of fileBuffers) {
          const caption = `📎 ${escapeHtml(fb.name)}`;
          if (IMAGE_TYPES.has(fb.type)) {
            await sendFeedbackPhoto(chatId, fb.buffer, fb.name, caption);
          } else {
            await sendFeedbackDocument(chatId, fb.buffer, fb.name, caption);
          }
        }
      } catch (e) {
        console.error("Telegram feedback notification failed:", e);
      }
    })();
  }

  return NextResponse.json({ success: true, id });
}
