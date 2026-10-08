import { NextResponse } from "next/server";
import { fetchRwaMeta } from "@/lib/binance/meta";
import { sessionAutopilot } from "@/lib/venue/ladder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const contract = searchParams.get("contract");
    if (!contract) {
      return NextResponse.json({
        ok: true,
        autopilot: sessionAutopilot(),
        meta: null,
      });
    }
    const meta = await fetchRwaMeta(contract);
    return NextResponse.json({
      ok: true,
      meta,
      autopilot: sessionAutopilot(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Meta failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
