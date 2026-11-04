import { NextResponse } from "next/server";
import { quoteSizeLadder, sessionAutopilot } from "@/lib/venue/ladder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker") || "NVDA";
    const wallet = searchParams.get("wallet") || undefined;
    const sizes = (searchParams.get("sizes") || "15,50,200")
      .split(",")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 5);

    const ladder = await quoteSizeLadder({ ticker, sizes, wallet });
    const autopilot = sessionAutopilot();
    return NextResponse.json({ ok: true, ladder, autopilot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ladder failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
