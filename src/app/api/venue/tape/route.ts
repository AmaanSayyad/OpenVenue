import { NextResponse } from "next/server";
import { resolveVenue } from "@/lib/venue/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Free preview of the paid Venue Tape deliverable (x402/B402 sells this). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get("ticker") || "NVDA").toUpperCase();
    const amount = Number(searchParams.get("amount") || "15");
    const decision = await resolveVenue({
      ticker,
      amountUsdt: Number.isFinite(amount) && amount > 0 ? amount : 15,
    });

    const deliverable = {
      ticker,
      generatedAt: new Date().toISOString(),
      session: decision.session,
      recommendation: decision.bestQuote
        ? `${decision.bestQuote.candidate.symbol} via ${decision.bestQuote.route.executionMode}`
        : decision.fallback === "park_defi"
          ? "park_defi"
          : "none",
      reason: decision.reason,
      wrappers: decision.quotes.map((q) => ({
        kind: q.candidate.kind,
        symbol: q.candidate.symbol,
        contractAddress: q.candidate.contractAddress,
        onChainPrice: q.candidate.onChainPrice,
        referencePrice: q.candidate.referencePrice,
        spreadBps: q.candidate.spreadBps,
        quoteOk: q.ok,
        executionMode: q.route?.executionMode,
        outAmountHuman: q.outAmountHuman,
      })),
    };

    return NextResponse.json({
      ok: true,
      priceUsd: 0.05,
      rails: ["erc-8183", "x402", "b402"],
      agent: "venuetape",
      deliverable,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tape failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
