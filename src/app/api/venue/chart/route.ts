import { NextResponse } from "next/server";
import {
  fetchTokenKlines,
  rangeToInterval,
  type ChartRange,
} from "@/lib/binance/kline";
import { searchRwaByTicker } from "@/lib/binance/rwa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES = new Set(["1D", "1W", "1M", "3M", "1Y", "ALL"]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get("ticker") || "NVDA").trim();
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

    if (!contract) {
      const candidates = await searchRwaByTicker(ticker);
      const preferred =
        candidates.find((c) => c.kind === "bstock") ||
        candidates.find((c) => c.kind === "ondo") ||
        candidates[0];
      if (!preferred?.contractAddress) {
        return NextResponse.json({
          ok: false,
          fallback: "tradingview",
          ticker: ticker.replace(/(on|b|x)$/i, "").toUpperCase(),
          error: "No BSC wrapper found for chart",
        });
      }
      contract = preferred.contractAddress.toLowerCase();
      symbol = preferred.symbol;
      kind = preferred.kind;
      referencePrice = preferred.referencePrice ?? preferred.onChainPrice;
    }

    const { interval, limit } = rangeToInterval(range);
    const candles = await fetchTokenKlines({
      chainId: 56,
      contractAddress: contract,
      interval,
      limit,
    });

    if (!candles.length) {
      return NextResponse.json({
        ok: false,
        fallback: "tradingview",
        ticker: ticker.replace(/(on|b|x)$/i, "").toUpperCase(),
        contract,
        error: "Empty kline series",
      });
    }

    const first = candles[0].close;
    const last = candles[candles.length - 1].close;
    const change = last - first;
    const changePct = first ? (change / first) * 100 : 0;

    return NextResponse.json({
      ok: true,
      source: "binance-rwa-kline",
      ticker: ticker.toUpperCase(),
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
