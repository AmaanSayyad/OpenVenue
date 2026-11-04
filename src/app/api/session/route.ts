import { NextResponse } from "next/server";
import { getUsEquitySession } from "@/lib/venue/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = getUsEquitySession();
  return NextResponse.json({
    ok: true,
    state: session.state,
    label: session.label,
    nextOpenIso: session.nextOpen.toISOString(),
    serverTimeIso: new Date().toISOString(),
  });
}
