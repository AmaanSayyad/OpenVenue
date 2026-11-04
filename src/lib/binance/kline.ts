import { referencePrice } from "@/lib/monad/venues";
import { equityTicker } from "@/lib/venue/tickers";
import {
  fetchEquityDaily,
  fetchEquityIntraday,
  fetchEquityQuote,
} from "@/lib/equity/nasdaq";

export type ChartRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export type KlineCandle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function rangeToInterval(range: ChartRange): {
  interval: string;
  limit: number;
  yahooInterval: string;
  yahooRange: string;
  days: number;
} {
  switch (range) {
    case "1D":
      return {
        interval: "1m",
        limit: 400,
        yahooInterval: "5m",
        yahooRange: "1d",
        days: 1,
      };
    case "1W":
      return {
        interval: "1h",
        limit: 168,
        yahooInterval: "60m",
        yahooRange: "5d",
        days: 7,
      };
    case "1M":
      return {
        interval: "1d",
        limit: 35,
        yahooInterval: "1d",
        yahooRange: "1mo",
        days: 35,
      };
    case "3M":
      return {
        interval: "1d",
        limit: 95,
        yahooInterval: "1d",
        yahooRange: "3mo",
        days: 95,
      };
    case "1Y":
      return {
        interval: "1d",
        limit: 270,
        yahooInterval: "1d",
        yahooRange: "1y",
        days: 370,
      };
    default:
      return {
        interval: "1wk",
        limit: 500,
        yahooInterval: "1wk",
        yahooRange: "5y",
        days: 365 * 5,
      };
  }
}

type YahooChartResult = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
};

async function fetchYahooCandles(
  symbol: string,
  yahooInterval: string,
  yahooRange: string,
): Promise<KlineCandle[]> {
  if (typeof window !== "undefined") return [];

  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("interval", yahooInterval);
  url.searchParams.set("range", yahooRange);
  url.searchParams.set("includePrePost", "false");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; OpenVenue/1.0; +https://openvenue.xyz)",
      Accept: "application/json",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as YahooChartResult;
  if (data.chart?.error?.description) return [];
  const result = data.chart?.result?.[0];
  const ts = result?.timestamp || [];
  const q = result?.indicators?.quote?.[0];
  if (!ts.length || !q) return [];

  const candles: KlineCandle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const open = q.open?.[i];
    const high = q.high?.[i];
    const low = q.low?.[i];
    const close = q.close?.[i];
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      !Number.isFinite(close)
    ) {
      continue;
    }
    candles.push({
      openTime: ts[i] * 1000,
      open,
      high,
      low,
      close,
      volume: q.volume?.[i] ?? 0,
    });
  }
  return candles;
}

/**
 * Equity OHLCV for the wrapper underlying.
 * Prefers Nasdaq public APIs; falls back to Yahoo chart when available.
 */
export async function fetchTokenKlines(params: {
  chainId?: number | string;
  contractAddress?: string;
  ticker?: string;
  interval?: string;
  limit?: number;
  range?: ChartRange;
}): Promise<KlineCandle[]> {
  const equity = equityTicker(params.ticker || "NVDA");
  const mapped = rangeToInterval(params.range || "1M");
  const limit = params.limit || mapped.limit;

  let nasdaqIntraday: KlineCandle[] = [];

  try {
    if (params.range === "1D" || mapped.days <= 1) {
      const intra = await fetchEquityIntraday(equity);
      if (intra.length > 1) {
        nasdaqIntraday = intra;
        // Nasdaq /chart bars are price-only (volume always 0). Prefer Yahoo
        // when it has real volume so Explore "24H Volume" is populated.
        const hasVol = intra.some((c) => (c.volume || 0) > 0);
        if (hasVol) {
          return intra.length > limit ? intra.slice(-limit) : intra;
        }
      }
    } else {
      const daily = await fetchEquityDaily(equity, mapped.days + 5);
      if (daily.length > 1) {
        return daily.length > limit ? daily.slice(-limit) : daily;
      }
    }
  } catch {
    /* fall through to Yahoo */
  }

  try {
    const candles = await fetchYahooCandles(
      equity,
      mapped.yahooInterval,
      mapped.yahooRange,
    );
    if (candles.length > 1) {
      return candles.length > limit ? candles.slice(-limit) : candles;
    }
  } catch {
    /* empty */
  }

  // Last resort: keep Nasdaq prices and stamp day ShareVolume on the last bar
  // so sum(volume) still shows a real 24h figure in Explore.
  if (nasdaqIntraday.length > 1) {
    try {
      const quote = await fetchEquityQuote(equity);
      const dayVol = quote?.volume ?? 0;
      if (dayVol > 0) {
        const stamped = nasdaqIntraday.map((c, i) =>
          i === nasdaqIntraday.length - 1 ? { ...c, volume: dayVol } : c,
        );
        return stamped.length > limit ? stamped.slice(-limit) : stamped;
      }
    } catch {
      /* ignore */
    }
    return nasdaqIntraday.length > limit
      ? nasdaqIntraday.slice(-limit)
      : nasdaqIntraday;
  }

  return [];
}

export async function fetchChartQuote(params: {
  chainId?: number | string;
  contractAddress: string;
  ticker?: string;
}) {
  const candles = await fetchTokenKlines({ ...params, range: "1M" });
  const last = candles[candles.length - 1];
  return {
    ok: true as const,
    price: last?.close ?? referencePrice(params.ticker || "NVDA"),
    candles,
    source: candles.length ? "equity-ohlcv" : "empty",
  };
}
