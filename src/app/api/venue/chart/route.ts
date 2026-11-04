import { NextResponse } from "next/server";
import {
  fetchTokenKlines,
  rangeToInterval,
  type ChartRange,
} from "@/lib/binance/kline";
import { searchRwaByTicker } from "@/lib/binance/rwa";
import { equityTicker } from "@/lib/venue/tickers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES = new Set(["1D", "1W", "1M", "3M", "1Y", "ALL"]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get("ticker") || "NVDA").trim();
    const equity = equityTicker(ticker);
    const range = (searchParams.get("range") || "1D").toUpperCase() as ChartRange;
    const contractParam = searchParams.get("contract") || undefined;

    if (!RANGES.has(range)) {
      return NextResponse.json(
        { ok: false, error: "Invalid range" },
        { status: 400 },
      );
    }

    let contract = contractParam?.toLowerCase();
    let symbol: string | undefined;
    let kind: string | undefined;
    let referencePrice: number | null = null;

    try {
      const candidates = await searchRwaByTicker(ticker);
      const preferred =
        candidates.find((c) => c.kind === "anchored") ||
        candidates.find((c) => c.kind === "xstock") ||
        candidates.find((c) => c.kind === "ondo") ||
        candidates.find((c) => c.kind === "bstock") ||
        candidates[0];
      if (preferred) {
        contract = contract || preferred.contractAddress?.toLowerCase();
        symbol = preferred.symbol;
        kind = preferred.kind;
        referencePrice = preferred.referencePrice ?? preferred.onChainPrice;
      }
    } catch {
      /* still chart the equity */
    }

    const { interval, limit } = rangeToInterval(range);
    let candles: Awaited<ReturnType<typeof fetchTokenKlines>> = [];
    let klineError: string | null = null;
    try {
      candles = await fetchTokenKlines({
        ticker: equity,
        interval,
        limit,
        range,
      });
    } catch (err) {
      klineError = err instanceof Error ? err.message : "Chart failed";
    }

    if (!candles.length) {
      return NextResponse.json({
        ok: false,
        fallback: "tradingview",
        ticker: equity,
        contract,
        symbol,
        kind,
        error: klineError || "No equity candles - open TradingView",
      });
    }

    const first = candles[0].close;
    const last = candles[candles.length - 1].close;
    const change = last - first;
    const changePct = first ? (change / first) * 100 : 0;

    return NextResponse.json({
      ok: true,
      source: "equity-ohlcv",
      ticker: equity,
      symbol,
      kind,
      contract,
      range,
      interval,
      referencePrice,
      last,
      change,
      changePct,
      candles: candles.map((c) => ({
        t: c.openTime,
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close,
        v: c.volume,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chart failed";
    return NextResponse.json(
      {
        ok: false,
        fallback: "tradingview",
        error: message,
      },
      { status: 500 },
    );
  }
}
