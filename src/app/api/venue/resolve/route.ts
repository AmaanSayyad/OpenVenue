import { NextResponse } from "next/server";
import { resolveVenue } from "@/lib/venue/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker") || "NVDA";
    const amount = Number(searchParams.get("amount") || "15");
    const wallet = searchParams.get("wallet") || undefined;
    const side = (searchParams.get("side") || "buy") as "buy" | "sell";
    const fromToken = searchParams.get("fromToken") || undefined;
    const fromAmountWei = searchParams.get("fromAmountWei") || undefined;

    if (side === "buy" && (!Number.isFinite(amount) || amount <= 0 || amount > 10_000)) {
      return NextResponse.json(
        { error: "amount must be between 0 and 10000 USDT" },
        { status: 400 },
      );
    }

    const decision = await resolveVenue({
      ticker,
      amountUsdt: amount,
      userWalletAddress: wallet,
      side,
      fromTokenAddress: fromToken,
      fromTokenAmountWei: fromAmountWei,
    });

    return NextResponse.json({ ok: true, decision, side });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenVenue resolve failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
