import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import { limitOrRespond } from "@/lib/rate-limit";

// 10 MB per file
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Whitelist of allowed mime types (images, PDFs, text, common docs, JSON, CSV)
const ALLOWED_MIME_TYPES = new Set<string>([
  // Images
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  // PDF
  "application/pdf",
  // Text
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  // Documents
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Data
  "application/json",
  "text/csv",
]);

const ALLOWED_EXTENSIONS = new Set<string>([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "pdf",
  "txt",
  "md",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "json",
  "csv",
]);

/**
 * Sanitize a filename to prevent path traversal and enforce a safe character set.
 * Only allows alphanumerics, dashes, underscores, and dots. Collapses repeats.
 */
function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() || "file";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || "file";
}

function sanitizeIdeaId(raw: string): string {
  // Idea IDs in this repo are slug-like; enforce safe chars only
  return raw.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "misc";
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx + 1).toLowerCase();
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 40,
    windowMs: 60 * 60 * 1000,
    bucket: "upload",
  });
  if (limited) return limited;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const ideaIdRaw = formData.get("ideaId");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)` },
        { status: 413 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    const safeName = sanitizeFilename(file.name || "file");
    const ext = getExtension(safeName);

    if (!ALLOWED_MIME_TYPES.has(mimeType) && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type not allowed: ${mimeType || ext || "unknown"}` },
        { status: 415 }
      );
    }

    const ideaId = sanitizeIdeaId(typeof ideaIdRaw === "string" ? ideaIdRaw : "misc");

    // Save under public/uploads/<ideaId>/<timestamp>-<name>
    const uploadsRoot = join(process.cwd(), "public", "uploads", ideaId);
    if (!existsSync(uploadsRoot)) {
      mkdirSync(uploadsRoot, { recursive: true });
    }

    const timestamp = Date.now();
    const storedName = `${timestamp}-${safeName}`;
    const absPath = join(uploadsRoot, storedName);

    // Extra safety: ensure path stays within uploadsRoot
    if (!absPath.startsWith(uploadsRoot)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(absPath, buffer);

    const url = `/uploads/${ideaId}/${storedName}`;

    return NextResponse.json({
      url,
      filename: safeName,
      size: file.size,
      mimeType,
    });
  } catch (e) {
    console.error("POST /api/upload error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
