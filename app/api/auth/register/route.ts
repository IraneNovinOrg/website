import { NextRequest, NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { success } = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait.", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists", code: "DUPLICATE" },
        { status: 409 }
      );
    }

    const user = await createUser(email, password, name);
    if (!user) {
      return NextResponse.json(
        { error: "Failed to create account. Please try again.", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    );
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
