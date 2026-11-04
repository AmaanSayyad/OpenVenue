import { NextResponse } from "next/server";
import { fetchRwaDynamic } from "@/lib/binance/dynamic";
import { fetchTokenKlines } from "@/lib/binance/kline";
import { searchRwaByTicker } from "@/lib/binance/rwa";
import { equityTicker } from "@/lib/venue/tickers";

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
    const equity = equityTicker(ticker);
    let contract = searchParams.get("contract") || undefined;

    if (!contract) {
      try {
        const cands = await searchRwaByTicker(ticker);
        const preferred =
          cands.find((c) => c.kind === "anchored") ||
          cands.find((c) => c.kind === "xstock") ||
          cands.find((c) => c.kind === "ondo") ||
          cands[0];
        contract = preferred?.contractAddress;
      } catch {
        /* optional */
      }
    }

    const [dynamicResult, candleResult] = await Promise.allSettled([
      fetchRwaDynamic(contract || "0x0", equity),
      fetchTokenKlines({
        ticker: equity,
        contractAddress: contract,
        range: "1D",
        limit: 400,
      }),
    ]);
    const dynamic =
      dynamicResult.status === "fulfilled" ? dynamicResult.value : null;
    const candles =
      candleResult.status === "fulfilled" ? candleResult.value : [];

    const sessionOhlc = ohlcFromCandles(candles);
    // Prefer live quote day range when candles are sparse (pre-market)
    const undFromQuote =
      dynamic && "stock" in dynamic && dynamic.stock
        ? (() => {
            const open =
              sessionOhlc?.open ??
              dynamic.stock.previousClose ??
              dynamic.stock.price ??
              null;
            const close =
              dynamic.stock.price ?? sessionOhlc?.close ?? null;
            const highCand =
              dynamic.stock.high ?? sessionOhlc?.high ?? null;
            const lowCand = dynamic.stock.low ?? sessionOhlc?.low ?? null;
            const high = Math.max(
              ...[highCand, open, close].filter(
                (n): n is number => n != null && Number.isFinite(n),
              ),
            );
            const low = Math.min(
              ...[lowCand, open, close].filter(
                (n): n is number => n != null && Number.isFinite(n),
              ),
            );
            return {
              open,
              high: Number.isFinite(high) ? high : null,
              low: Number.isFinite(low) ? low : null,
              close,
            };
          })()
        : null;

    const underlyingOhlc =
      undFromQuote &&
      undFromQuote.open != null &&
      undFromQuote.high != null &&
      undFromQuote.low != null
        ? {
            open: undFromQuote.open,
            high: undFromQuote.high,
            low: undFromQuote.low,
            close: undFromQuote.close ?? undefined,
          }
        : sessionOhlc;

    // Until live Monad wrapper pools publish distinct marks, token track
    // mirrors the underlying equity series the venues settle against.
    const tokenOhlc = underlyingOhlc;

    const stock = dynamic && "stock" in dynamic ? dynamic.stock : null;
    const baseLimit =
      dynamic && "limits" in dynamic
        ? dynamic.limits.maxActiveNotional
        : 1_200_000;

    return NextResponse.json({
      ok: true,
      ticker: equity,
      contract: contract || null,
      symbol: (dynamic && "symbol" in dynamic && dynamic.symbol) || equity,
      tokenOhlc,
      underlyingOhlc,
      stock: stock
        ? {
            marketCap: stock.marketCap ?? null,
            volume: stock.volume ?? null,
            averageVolume: stock.averageVolume ?? null,
            dividendYield: stock.dividendYield ?? null,
            lastCashAmount: stock.lastCashAmount ?? null,
            high52w: stock.high52w ?? null,
            low52w: stock.low52w ?? null,
            pe: stock.pe ?? null,
            price: stock.price ?? null,
            changePercent: stock.changePercent ?? null,
          }
        : null,
      token: dynamic && "token" in dynamic ? dynamic.token : null,
      status: dynamic && "status" in dynamic ? dynamic.status : null,
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
        marketHoursLabel: "Sun 6:00 PM ET - Fri 8:00 PM ET",
        offHoursLabel: "Fri 8:00 PM ET - Sun 6:00 PM ET, Holidays",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stats failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
