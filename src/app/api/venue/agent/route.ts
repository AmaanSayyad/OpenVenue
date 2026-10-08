import { NextResponse } from "next/server";
import { parseAgentIntent } from "@/lib/venue/agent";
import { resolveVenue } from "@/lib/venue/router";
import { quoteSizeLadder, sessionAutopilot } from "@/lib/venue/ladder";
import { listUsdtEarnInvestments } from "@/lib/binance/defi";
import { buildPortfolio, CORE_TICKERS, TRACKED_WRAPPERS } from "@/lib/binance/wallet";
import { searchRwaByTicker } from "@/lib/binance/rwa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { prompt?: string; wallet?: string };
    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    const intent = parseAgentIntent(prompt);
    const autopilot = sessionAutopilot();

    if (intent.action === "unknown") {
      return NextResponse.json({ ok: true, intent, autopilot, result: null });
    }

    if (intent.action === "buy") {
      const decision = await resolveVenue({
        ticker: intent.ticker,
        amountUsdt: intent.amountUsdt,
        userWalletAddress: body.wallet,
      });
      return NextResponse.json({
        ok: true,
        intent,
        autopilot,
        result: { type: "decision", decision },
      });
    }

    if (intent.action === "ladder") {
      const ladder = await quoteSizeLadder({
        ticker: intent.ticker,
        sizes: [15, 50, 200],
        wallet: body.wallet,
      });
      return NextResponse.json({
        ok: true,
        intent,
        autopilot,
        result: { type: "ladder", ladder },
      });
    }

    if (intent.action === "park") {
      const park = await listUsdtEarnInvestments();
      return NextResponse.json({
        ok: true,
        intent,
        autopilot,
        result: { type: "park", items: park.items?.slice(0, 5) || [] },
      });
    }

    if (intent.action === "portfolio") {
      if (!body.wallet) {
        return NextResponse.json({
          ok: true,
          intent,
          autopilot,
          result: { type: "portfolio", error: "Connect wallet first" },
        });
      }
      const discovered = [...TRACKED_WRAPPERS];
      const seen = new Set(discovered.map((d) => d.address.toLowerCase()));
      for (const t of CORE_TICKERS.slice(0, 4)) {
        const cands = await searchRwaByTicker(t);
        for (const c of cands) {
          if (seen.has(c.contractAddress)) continue;
          seen.add(c.contractAddress);
          discovered.push({
            address: c.contractAddress,
            symbol: c.symbol,
            ticker: t,
            kind: c.kind,
            platform: c.platform,
          });
        }
      }
      const portfolio = await buildPortfolio({
        wallet: body.wallet,
        contracts: discovered,
      });
      return NextResponse.json({
        ok: true,
        intent,
        autopilot,
        result: { type: "portfolio", portfolio },
      });
    }

    if (intent.action === "sell") {
      const sym = intent.tickerOrSymbol;
      const ticker = sym.replace(/(ON|B|X)$/i, "");
      // Find contract via search
      const cands = await searchRwaByTicker(ticker);
      const match =
        cands.find((c) => c.symbol.toUpperCase() === sym.toUpperCase()) ||
        cands[0];
      if (!match) {
        return NextResponse.json({
          ok: true,
          intent,
          autopilot,
          result: { type: "sell", error: `No wrapper for ${sym}` },
        });
      }
      return NextResponse.json({
        ok: true,
        intent,
        autopilot,
        result: {
          type: "sell",
          candidate: match,
          fraction: intent.fraction,
          hint: "Open Portfolio → Sell, or call /api/venue/resolve?side=sell with fromAmountWei",
        },
      });
    }

    return NextResponse.json({ ok: true, intent, autopilot, result: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
