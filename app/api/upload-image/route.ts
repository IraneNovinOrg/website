import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GITHUB_ORG, GITHUB_IDEAS_REPO, GITHUB_BOT_TOKEN } from "@/lib/constants";
import { limitOrRespond } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const rlUserId =
    (session.user as { id?: string }).id || session.user.email || null;
  const limited = limitOrRespond(request, rlUserId, {
    max: 40,
    windowMs: 60 * 60 * 1000,
    bucket: "upload-image",
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { filename, content } = body;

    if (!filename || !content) {
      return NextResponse.json(
        { error: "Missing filename or content", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Generate unique path
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `_uploads/${timestamp}-${safeName}`;

    // Upload to GitHub repo via Contents API
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_IDEAS_REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `upload: ${safeName}`,
          content: content, // already base64
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("Image upload failed:", err);
      return NextResponse.json(
        { error: "Upload failed", code: "GITHUB_ERROR" },
        { status: 500 }
      );
    }

    const data = await res.json();
    // Use the raw GitHub URL for the image
    const url = data.content?.download_url || data.content?.html_url;

    return NextResponse.json({ url });
  } catch (e) {
    console.error("POST /api/upload-image error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
