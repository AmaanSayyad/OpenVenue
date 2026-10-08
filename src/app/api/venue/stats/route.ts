import { NextResponse } from "next/server";
import { fetchRwaDynamic } from "@/lib/binance/dynamic";
import { fetchTokenKlines } from "@/lib/binance/kline";
import { searchRwaByTicker } from "@/lib/binance/rwa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ohlcFromCandles(
  candles: Array<{ open: number; high: number; low: number; close: number }>,
) {
  if (!candles.length) return null;
  let high = -Infinity;
  let low = Infinity;
  for (const c of candles) {
    high = Math.max(high, c.high);
    low = Math.min(low, c.low);
  }
  return {
    open: candles[0].open,
    high,
    low,
    close: candles[candles.length - 1].close,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get("ticker") || "NVDA").trim();
    let contract = searchParams.get("contract") || undefined;

    if (!contract) {
      const cands = await searchRwaByTicker(ticker);
      const preferred =
        cands.find((c) => c.kind === "ondo") ||
        cands.find((c) => c.kind === "bstock") ||
        cands[0];
      contract = preferred?.contractAddress;
    }

    if (!contract) {
      return NextResponse.json(
        { ok: false, error: "No contract for stats" },
        { status: 404 },
      );
    }

    const [dynamic, candles] = await Promise.all([
      fetchRwaDynamic(contract),
      fetchTokenKlines({
        chainId: 56,
        contractAddress: contract,
        interval: "15m",
        limit: 96,
      }),
    ]);

    const tokenOhlc = ohlcFromCandles(candles);
    const stockPrice =
      dynamic?.stock.price ??
      dynamic?.token.price ??
      tokenOhlc?.close ??
      null;

    // Approximate underlying OHLC from token series when stock ticks absent
    const ratio =
      stockPrice != null && tokenOhlc?.close
        ? stockPrice / tokenOhlc.close
        : 1;
    const underlyingOhlc = tokenOhlc
      ? {
          open: tokenOhlc.open * ratio,
          high: tokenOhlc.high * ratio,
          low: tokenOhlc.low * ratio,
          close: tokenOhlc.close * ratio,
        }
      : null;

    const baseLimit = dynamic?.limits.maxActiveNotional ?? 1_200_000;

    return NextResponse.json({
      ok: true,
      ticker: ticker.toUpperCase(),
      contract,
      symbol: dynamic?.symbol || null,
      tokenOhlc,
      underlyingOhlc,
      stock: dynamic?.stock || null,
      token: dynamic?.token || null,
      status: dynamic?.status || null,
      sessionLimits: {
        marketHours: [
          {
            session: "Pre-Market",
            hours: "4:00:00 AM - 9:29:59 AM",
            limit: Math.round(baseLimit),
            icon: "bridge",
          },
          {
            session: "Regular",
            hours: "9:30:00 AM - 3:59:59 PM",
            limit: Math.round(baseLimit * 2.5),
            icon: "sun",
          },
          {
            session: "Post-Market",
            hours: "4:00:00 PM - 7:59:59 PM",
            limit: Math.round(baseLimit),
            icon: "bridge",
          },
          {
            session: "Overnight",
            hours: "8:00:00 PM - 3:59:59 AM",
            limit: Math.round(baseLimit),
            icon: "moon",
          },
        ],
        offHours: [
          {
            session: "Off-Hours",
            hours: "Continuous",
            limit: Math.round(baseLimit * 0.85),
            icon: "off",
          },
        ],
        marketHoursLabel: "Sun 8:00 PM ET - Fri 8:00 PM ET",
        offHoursLabel: "Fri 8:00 PM ET - Sun 8:00 PM ET, Holidays",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stats failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
