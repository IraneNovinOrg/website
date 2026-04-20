import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  revalidatePath("/en/ideas", "page");
  revalidatePath("/fa/ideas", "page");
  revalidatePath("/en", "page");
  revalidatePath("/fa", "page");
  revalidateTag("ideas");
  revalidateTag("iab-ideas");

  return NextResponse.json({
    revalidated: true,
    timestamp: new Date().toISOString(),
  });
}
