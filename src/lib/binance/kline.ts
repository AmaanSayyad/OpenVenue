/** Public Binance Web3 RWA token K-line (no OC keys required). */

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "12h" | "1d";

export type ChartRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

const KLINE_URL =
  "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/dex/market/token/kline/ai";

export function rangeToInterval(range: ChartRange): {
  interval: ChartInterval;
  limit: number;
} {
  switch (range) {
    case "1D":
      return { interval: "15m", limit: 96 };
    case "1W":
      return { interval: "1h", limit: 168 };
    case "1M":
      return { interval: "4h", limit: 180 };
    case "3M":
      return { interval: "1d", limit: 90 };
    case "1Y":
      return { interval: "1d", limit: 300 };
    case "ALL":
    default:
      return { interval: "1d", limit: 300 };
  }
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const klineCache = new Map<string, { at: number; candles: Candle[] }>();
const klineFlight = new Map<string, Promise<Candle[]>>();
const KLINE_TTL_MS = 90_000;
let klineNextAt = 0;

async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const wait = Math.max(0, klineNextAt - Date.now());
  klineNextAt = Date.now() + wait + 200;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  return fn();
}

export async function fetchTokenKlines(opts: {
  chainId?: string | number;
  contractAddress: string;
  interval: ChartInterval;
  limit?: number;
}): Promise<Candle[]> {
  const limit = Math.min(opts.limit ?? 100, 300);
  const key = `${opts.chainId ?? 56}|${opts.contractAddress.toLowerCase()}|${opts.interval}|${limit}`;
  const fresh = klineCache.get(key);
  if (fresh && Date.now() - fresh.at < KLINE_TTL_MS) return fresh.candles;
  const pending = klineFlight.get(key);
  if (pending) return pending;

  const job = paced(() => loadTokenKlines(opts, limit))
    .then((candles) => {
      klineFlight.delete(key);
      if (candles.length) klineCache.set(key, { at: Date.now(), candles });
      return candles.length ? candles : fresh?.candles ?? candles;
    })
    .catch((err) => {
      klineFlight.delete(key);
      if (fresh) return fresh.candles;
      throw err;
    });
  klineFlight.set(key, job);
  return job;
}

async function loadTokenKlines(
  opts: {
    chainId?: string | number;
    contractAddress: string;
    interval: ChartInterval;
  },
  limit: number,
): Promise<Candle[]> {
  const params = new URLSearchParams({
    chainId: String(opts.chainId ?? 56),
    contractAddress: opts.contractAddress,
    interval: opts.interval,
    limit: String(limit),
  });

  const res = await fetch(`${KLINE_URL}?${params}`, {
    headers: {
      "Accept-Encoding": "identity",
      "User-Agent": "binance-web3/1.1 (Skill)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      res.status === 429 ? "Rate limit exceeded" : `K-line HTTP ${res.status}`,
    );
  }

  const json = (await res.json()) as {
    code?: string;
    success?: boolean;
    data?: { klineInfos?: unknown[] };
    message?: string;
  };

  if (json.code !== "000000" && json.success !== true) {
    throw new Error(json.message || "K-line request failed");
  }

  const rows = json.data?.klineInfos || [];
  return rows
    .map((row) => {
      if (!Array.isArray(row) || row.length < 5) return null;
      return {
        openTime: num(row[0]),
        open: num(row[1]),
        high: num(row[2]),
        low: num(row[3]),
        close: num(row[4]),
        volume: num(row[5]),
        closeTime: num(row[6] ?? row[0]),
      } satisfies Candle;
    })
    .filter((c): c is Candle => !!c && c.close > 0)
    .sort((a, b) => a.openTime - b.openTime);
}
