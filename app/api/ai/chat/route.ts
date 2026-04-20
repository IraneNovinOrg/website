import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatWithContext, getChatHistory } from "@/lib/ai";
import { getAcceptedWork } from "@/lib/ai-tasks";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const ideaId = request.nextUrl.searchParams.get("ideaId");
  if (!ideaId) {
    return NextResponse.json({ error: "ideaId required" }, { status: 400 });
  }
  const history = getChatHistory(ideaId);
  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ideaId, ideaTitle, ideaBody, message } = body;

    if (!ideaId || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const history = getChatHistory(ideaId);
    const acceptedWork = getAcceptedWork(ideaId).map((w) => ({
      taskTitle: w.taskId,
      summary: w.content.slice(0, 200),
    }));

    const userId = session.user.id || session.user.email || "unknown";
    const userName = session.user.name || "Anonymous";

    const { response, updatedHistory } = await chatWithContext(
      ideaId,
      { title: ideaTitle || "Idea", body: ideaBody || "" },
      acceptedWork,
      history,
      message,
      userId,
      userName
    );

    return NextResponse.json({ response, history: updatedHistory });
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.error("POST /api/ai/chat error:", e);
    logError(`POST /api/ai/chat failed: ${msg}`, "api-ai-chat");

    const friendly = /api key|token|OPENAI|ANTHROPIC|All.*model|rate limit|timeout|authentication|No AI models/i.test(msg)
      ? `The AI assistant is temporarily unavailable. (${msg.slice(0, 300)})`
      : `The AI assistant could not generate a reply right now. (${msg.slice(0, 200)})`;

    return NextResponse.json(
      { error: friendly, code: "AI_ERROR" },
      { status: 503 }
    );
  }
}
