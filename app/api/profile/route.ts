import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById, updateProfile } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const profile = await getUserById(session.user.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash: _hash, ...safeProfile } = profile;
  return NextResponse.json({ profile: safeProfile });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      name, bio, skills, location, timezone, languages,
      hoursPerWeek, categories, telegramHandle, linkedInUrl,
      profileCompleted, notificationPrefs,
    } = body;

    const updated = await updateProfile(session.user.id, {
      name: name !== undefined ? name : undefined,
      bio: bio !== undefined ? bio : undefined,
      skills: Array.isArray(skills) ? skills : undefined,
      location: location !== undefined ? location : undefined,
      timezone: timezone !== undefined ? timezone : undefined,
      languages: Array.isArray(languages) ? languages : undefined,
      hoursPerWeek: hoursPerWeek !== undefined ? hoursPerWeek : undefined,
      categories: Array.isArray(categories) ? categories : undefined,
      telegramHandle: telegramHandle !== undefined ? telegramHandle : undefined,
      linkedInUrl: linkedInUrl !== undefined ? linkedInUrl : undefined,
      profileCompleted: profileCompleted !== undefined ? profileCompleted : undefined,
      // Whitelist keys — prevents the client from stuffing arbitrary prefs.
      notificationPrefs:
        notificationPrefs && typeof notificationPrefs === "object"
          ? {
              email: !!notificationPrefs.email,
              emailDigest: !!notificationPrefs.emailDigest,
              taskMatches: !!notificationPrefs.taskMatches,
              expertReviews: !!notificationPrefs.expertReviews,
              projectUpdates: !!notificationPrefs.projectUpdates,
              weeklyDigest: !!notificationPrefs.weeklyDigest,
            }
          : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update profile", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _pw, ...safeProfile } = updated;
    return NextResponse.json({ profile: safeProfile });
  } catch (e) {
    console.error("Profile update error:", e);
    return NextResponse.json(
      { error: "Server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
