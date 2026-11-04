import type { ChartRange } from "@/lib/binance/kline";

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

/** Load equity OHLCV via the server chart route (Yahoo). */
export async function loadChart(
  ticker: string,
  range: ChartRange = "1D",
  contract?: string | null,
): Promise<ChartPayload> {
  const qs = new URLSearchParams({ ticker, range });
  if (contract) qs.set("contract", contract);

  try {
    const api = (await fetch(`/api/venue/chart?${qs}`).then((r) =>
      r.json(),
    )) as ChartPayload;
    if (api.ok && (api.candles?.length || 0) > 1 && api.last != null) return api;
    return { ...api, contract: api.contract || contract || undefined, ticker };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Chart error",
      ticker,
      contract: contract || undefined,
    };
  }
}
