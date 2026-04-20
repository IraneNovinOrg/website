import { NextRequest, NextResponse } from "next/server";
import { createAnonymousSuggestion } from "@/lib/github";
import { sendSuggestionConfirmation } from "@/lib/resend";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { success } = rateLimit(`anon-suggest:${ip}`, 3, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { title, body: suggestionBody, email } = body;

    if (!suggestionBody) {
      return NextResponse.json(
        { error: "Body is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const created = await createAnonymousSuggestion(
      title || "Quick suggestion",
      suggestionBody,
      email
    );

    if (!created) {
      return NextResponse.json(
        { error: "Failed to create suggestion", code: "GITHUB_ERROR" },
        { status: 500 }
      );
    }

    if (email) {
      await sendSuggestionConfirmation(email);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    console.error("POST /api/anonymous-suggest error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
