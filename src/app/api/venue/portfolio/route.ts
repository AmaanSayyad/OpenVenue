import { NextResponse } from "next/server";
import { searchRwaByTicker } from "@/lib/binance/rwa";
import {
  buildPortfolio,
  CORE_TICKERS,
  TRACKED_WRAPPERS,
} from "@/lib/binance/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "valid wallet required" }, { status: 400 });
    }

    const extra = (searchParams.get("tokens") || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^0x[a-f0-9]{40}$/.test(s));

    const discovered = [...TRACKED_WRAPPERS];
    const seen = new Set(discovered.map((d) => d.address.toLowerCase()));

    for (const ticker of CORE_TICKERS) {
      try {
        const cands = await searchRwaByTicker(ticker);
        for (const c of cands) {
          if (seen.has(c.contractAddress)) continue;
          seen.add(c.contractAddress);
          discovered.push({
            address: c.contractAddress,
            symbol: c.symbol,
            ticker,
            kind: c.kind,
            platform: c.platform,
          });
        }
      } catch {
        /* continue */
      }
    }

    for (const addr of extra) {
      if (seen.has(addr)) continue;
      seen.add(addr);
      discovered.push({
        address: addr,
        symbol: "TOKEN",
        ticker: "?",
        kind: "bstock",
        platform: "unknown",
      });
    }

    const portfolio = await buildPortfolio({ wallet, contracts: discovered });
    return NextResponse.json({ ok: true, portfolio });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portfolio failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
