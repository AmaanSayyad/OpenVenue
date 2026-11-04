import { NextResponse } from "next/server";
import { searchRwaByTicker } from "@/lib/binance/rwa";
import { baseTicker, CORE_TICKERS, tickerMeta } from "@/lib/venue/tickers";
import { kindLabel } from "@/lib/venue/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json({ ok: true, results: [] });
    }

    const lower = q.toLowerCase();
    const local = CORE_TICKERS.filter((t) => {
      const m = tickerMeta(t);
      return (
        t.toLowerCase().includes(lower) ||
        m.name.toLowerCase().includes(lower) ||
        m.onSymbol.toLowerCase().includes(lower)
      );
    }).map((t) => {
      const m = tickerMeta(t);
      return {
        ticker: t,
        symbol: m.onSymbol,
        name: m.name,
        logo: m.logo,
        kindLabel: "Core",
        contractAddress: null as string | null,
        onChainPrice: null as number | null,
      };
    });

    try {
      const cands = await searchRwaByTicker(q);
      const remote = cands.slice(0, 14).map((c) => {
        const ticker = baseTicker(c.symbol) || q.toUpperCase();
        const m = tickerMeta(ticker);
        return {
          ticker,
          symbol: c.symbol,
          name: c.name || m.name,
          logo: c.logoUrl || m.logo,
          kindLabel: kindLabel(c.kind),
          contractAddress: c.contractAddress,
          onChainPrice: c.onChainPrice,
        };
      });

      const seen = new Set<string>();
      const results = [...local, ...remote].filter((row) => {
        const key = `${row.ticker}:${row.symbol}`.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return NextResponse.json({ ok: true, results: results.slice(0, 16) });
    } catch {
      return NextResponse.json({ ok: true, results: local });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
