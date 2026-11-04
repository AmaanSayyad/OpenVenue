import { fetchEquityQuote } from "@/lib/equity/nasdaq";
import { equityTicker } from "@/lib/venue/tickers";

export async function fetchRwaDynamic(contract: string, ticker?: string) {
  const symbol = equityTicker(ticker || "NVDA");
  const quote = await fetchEquityQuote(symbol);

  if (!quote) {
    return {
      ok: false as const,
      contract,
      chain: "monad",
      symbol,
      stock: null,
      token: null,
      status: null,
      limits: { min: 1, max: 100000, maxActiveNotional: 1_200_000 },
    };
  }

  const price = quote.price;
  return {
    ok: true as const,
    contract,
    chain: "monad",
    symbol: quote.symbol,
    name: quote.name,
    change24hPercent: quote.changePercent,
    volume24hUsd: quote.volume,
    stock: {
      price,
      change: quote.change,
      changePercent: quote.changePercent,
      marketCap: quote.marketCap,
      volume: quote.volume,
      averageVolume: quote.averageVolume,
      dividendYield: quote.dividendYield,
      lastCashAmount: quote.lastCashAmount,
      high52w: quote.high52w,
      low52w: quote.low52w,
      pe: quote.pe,
      previousClose: quote.previousClose,
      open: quote.open,
      high: quote.high,
      low: quote.low,
    },
    token: {
      price,
      changePercent: quote.changePercent,
    },
    status: quote.marketStatus || "open",
    limits: { min: 1, max: 100000, maxActiveNotional: 1_200_000 },
  };
}
