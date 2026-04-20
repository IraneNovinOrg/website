import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  // Return public config values (no secrets)
  try {
    const telegramConfig = JSON.parse(
      readFileSync(join(process.cwd(), "_config", "telegram.json"), "utf-8")
    );

    return NextResponse.json({
      telegram: {
        botUsername: telegramConfig.botUsername,
        channelUsername: telegramConfig.channelUsername,
        channelUrl: telegramConfig.channelUrl,
      },
    }, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate" },
    });
  } catch {
    return NextResponse.json({
      telegram: {
        botUsername: "IranENovinBot",
        channelUsername: "iranenovin0",
        channelUrl: "https://t.me/iranenovin0",
      },
    });
  }
}
