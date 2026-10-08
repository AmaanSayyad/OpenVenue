export type TickerMeta = {
  name: string;
  logo: string;
  onSymbol: string;
};

export const TICKER_META: Record<string, TickerMeta> = {
  NVDA: { name: "NVIDIA", logo: "/brand/logos/nvdaon.png", onSymbol: "NVDAon" },
  AAPL: { name: "Apple", logo: "/brand/logos/aaplon.png", onSymbol: "AAPLon" },
  TSLA: { name: "Tesla", logo: "/brand/logos/tslaon.png", onSymbol: "TSLAon" },
  META: { name: "Meta", logo: "/brand/logos/metaon.png", onSymbol: "METAon" },
  SPY: { name: "S&P 500", logo: "/brand/logos/spyon.png", onSymbol: "SPYon" },
  AMZN: { name: "Amazon", logo: "/brand/logos/amznon.png", onSymbol: "AMZNon" },
  GOOGL: {
    name: "Alphabet",
    logo: "/brand/logos/googlon.png",
    onSymbol: "GOOGLon",
  },
  MSFT: {
    name: "Microsoft",
    logo: "/brand/logos/msfton.png",
    onSymbol: "MSFTon",
  },
  AMD: { name: "AMD", logo: "/brand/logos/amdon.png", onSymbol: "AMDon" },
  NFLX: {
    name: "Netflix",
    logo: "/brand/logos/nflxon.png",
    onSymbol: "NFLXon",
  },
};

export const CORE_TICKERS = Object.keys(TICKER_META);

/** Underlying ticker. Wrapper suffixes (on / b / x) are removed only when the base is known, so NFLX stays NFLX. */
export function baseTicker(symbol: string): string {
  const raw = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (TICKER_META[raw]) return raw;
  const stripped = raw.replace(/(ON|B|X)$/, "");
  if (stripped !== raw && TICKER_META[stripped]) return stripped;
  return raw;
}

export function tickerMeta(ticker: string): TickerMeta {
  const key = baseTicker(ticker);
  return (
    TICKER_META[key] || {
      name: key,
      logo: "/brand/mark.svg",
      onSymbol: `${key}on`,
    }
  );
}
