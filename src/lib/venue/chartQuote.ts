import {
  fetchTokenKlines,
  rangeToInterval,
  type ChartRange,
} from "@/lib/binance/kline";

export type ChartCandle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type ChartPayload = {
  ok: boolean;
  last?: number;
  change?: number;
  changePct?: number;
  candles?: ChartCandle[];
  contract?: string;
  symbol?: string;
  kind?: string;
  ticker?: string;
  error?: string;
  source?: string;
};

function fromCandles(
  ticker: string,
  contract: string,
  candles: Array<{
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>,
): ChartPayload {
  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  const change = last - first;
  return {
    ok: true,
    source: "binance-rwa-kline",
    ticker,
    contract,
    last,
    change,
    changePct: first ? (change / first) * 100 : 0,
    candles: candles.map((c) => ({
      t: c.openTime,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: c.volume,
    })),
  };
}

/** Server chart, then the public kline from the browser if the host is blocked. */
export async function loadChart(
  ticker: string,
  range: ChartRange = "1D",
  contract?: string | null,
): Promise<ChartPayload> {
  const qs = new URLSearchParams({ ticker, range });
  if (contract) qs.set("contract", contract);

  let api: ChartPayload = { ok: false, error: "Chart error" };
  try {
    api = (await fetch(`/api/venue/chart?${qs}`).then((r) => r.json())) as ChartPayload;
  } catch (err) {
    api = {
      ok: false,
      error: err instanceof Error ? err.message : "Chart error",
    };
  }

  if (api.ok && (api.candles?.length || 0) > 1 && api.last != null) return api;

  const addr = api.contract || contract;
  if (!addr) return api;

  try {
    const { interval, limit } = rangeToInterval(range);
    const candles = await fetchTokenKlines({
      chainId: 56,
      contractAddress: addr,
      interval,
      limit,
    });
    if (candles.length > 1) return fromCandles(ticker, addr, candles);
  } catch {
    /* keep the server error and let the equity chart take over */
  }

  return { ...api, contract: addr };
}
