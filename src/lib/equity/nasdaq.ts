import { equityTicker } from "@/lib/venue/tickers";
import type { KlineCandle } from "@/lib/binance/kline";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parseMoney(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = raw.replace(/[$,%\s]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === "N/A" || cleaned === "NA" || cleaned === "-")
    return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseRangePair(raw: string | null | undefined): {
  high: number | null;
  low: number | null;
} {
  if (!raw || raw === "N/A" || raw === "NA") return { high: null, low: null };
  const parts = raw.split("/").map((s) => parseMoney(s.trim()));
  if (parts.length >= 2) return { high: parts[0], low: parts[1] };
  // "164.27 - 243.37"
  const dash = raw.split(/\s*-\s*/).map((s) => parseMoney(s.trim()));
  if (dash.length >= 2) return { low: dash[0], high: dash[1] };
  return { high: null, low: null };
}

async function nasdaqGet<T>(path: string): Promise<T | null> {
  if (typeof window !== "undefined") return null;
  const url = path.startsWith("http")
    ? path
    : `https://api.nasdaq.com${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": UA,
      Origin: "https://www.nasdaq.com",
      Referer: "https://www.nasdaq.com/",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export type EquityQuote = {
  symbol: string;
  name: string | null;
  price: number | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  averageVolume: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  lastCashAmount: number | null;
  high52w: number | null;
  low52w: number | null;
  pe: number | null;
  marketStatus: string | null;
  exchange: string | null;
};

export async function fetchEquityQuote(ticker: string): Promise<EquityQuote | null> {
  const symbol = equityTicker(ticker);
  type InfoRes = {
    data?: {
      companyName?: string;
      exchange?: string;
      marketStatus?: string;
      primaryData?: {
        lastSalePrice?: string;
        netChange?: string;
        percentageChange?: string;
        volume?: string;
      };
      secondaryData?: {
        lastSalePrice?: string;
      };
      keyStats?: {
        fiftyTwoWeekHighLow?: { value?: string };
        dayrange?: { value?: string };
      };
    };
  };
  type SummaryRes = {
    data?: {
      summaryData?: Record<string, { value?: string } | undefined>;
    };
  };

  const [info, summary] = await Promise.all([
    nasdaqGet<InfoRes>(
      `/api/quote/${encodeURIComponent(symbol)}/info?assetclass=stocks`,
    ),
    nasdaqGet<SummaryRes>(
      `/api/quote/${encodeURIComponent(symbol)}/summary?assetclass=stocks`,
    ),
  ]);

  if (!info?.data && !summary?.data) return null;

  const sd = summary?.data?.summaryData || {};
  const primary = info?.data?.primaryData;
  const day = parseRangePair(info?.data?.keyStats?.dayrange?.value);
  const week = parseRangePair(
    sd.FiftTwoWeekHighLow?.value ||
      info?.data?.keyStats?.fiftyTwoWeekHighLow?.value,
  );
  const todayHL = parseRangePair(sd.TodayHighLow?.value);

  const price =
    parseMoney(primary?.lastSalePrice) ??
    parseMoney(info?.data?.secondaryData?.lastSalePrice);
  const change = parseMoney(primary?.netChange);
  const changePercent = parseMoney(
    primary?.percentageChange?.replace("+", ""),
  );

  return {
    symbol,
    name: info?.data?.companyName || null,
    price,
    previousClose: parseMoney(sd.PreviousClose?.value),
    open: null,
    high: todayHL.high ?? day.high,
    low: todayHL.low ?? day.low,
    change,
    changePercent,
    volume:
      parseMoney(sd.ShareVolume?.value) ?? parseMoney(primary?.volume),
    averageVolume: parseMoney(sd.AverageVolume?.value),
    marketCap: parseMoney(sd.MarketCap?.value),
    dividendYield: parseMoney(sd.Yield?.value),
    lastCashAmount: parseMoney(sd.AnnualizedDividend?.value),
    high52w: week.high,
    low52w: week.low,
    pe: null,
    marketStatus: info?.data?.marketStatus || null,
    exchange: info?.data?.exchange || sd.Exchange?.value || null,
  };
}

/** Intraday minute bars (pre/regular when available). */
export async function fetchEquityIntraday(
  ticker: string,
): Promise<KlineCandle[]> {
  const symbol = equityTicker(ticker);
  type ChartRes = {
    data?: {
      chart?: Array<{ x: number; y: number }>;
      previousClose?: string;
    };
  };
  const res = await nasdaqGet<ChartRes>(
    `/api/quote/${encodeURIComponent(symbol)}/chart?assetclass=stocks`,
  );
  const points = res?.data?.chart || [];
  if (points.length < 2) return [];

  const candles: KlineCandle[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!Number.isFinite(p.y) || !Number.isFinite(p.x)) continue;
    const prev = candles[candles.length - 1];
    const open = prev?.close ?? p.y;
    candles.push({
      openTime: p.x,
      open,
      high: Math.max(open, p.y),
      low: Math.min(open, p.y),
      close: p.y,
      volume: 0,
    });
  }
  return candles;
}

/** Daily historical bars, newest-first from Nasdaq → oldest-first candles. */
export async function fetchEquityDaily(
  ticker: string,
  days = 365,
): Promise<KlineCandle[]> {
  const symbol = equityTicker(ticker);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  const fmt = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

  type HistRes = {
    data?: {
      tradesTable?: {
        rows?: Array<{
          date: string;
          open: string;
          high: string;
          low: string;
          close: string;
          volume: string;
        }>;
      };
    };
  };

  const res = await nasdaqGet<HistRes>(
    `/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=stocks&fromdate=${fmt(from)}&todate=${fmt(to)}&limit=${Math.min(days, 1500)}`,
  );
  const rows = res?.data?.tradesTable?.rows || [];
  const candles: KlineCandle[] = [];
  for (const row of rows) {
    const close = parseMoney(row.close);
    const open = parseMoney(row.open);
    const high = parseMoney(row.high);
    const low = parseMoney(row.low);
    if (close == null || open == null || high == null || low == null) continue;
    const parts = row.date.split("/");
    if (parts.length !== 3) continue;
    const [mm, dd, yyyy] = parts.map(Number);
    const openTime = Date.UTC(yyyy, mm - 1, dd, 20, 0, 0); // ~4pm ET as UTC proxy
    candles.push({
      openTime,
      open,
      high,
      low,
      close,
      volume: parseMoney(row.volume) || 0,
    });
  }
  // Nasdaq returns newest first
  candles.reverse();
  return candles;
}
