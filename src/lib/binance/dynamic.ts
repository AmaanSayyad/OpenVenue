/** RWA Dynamic V2 - on-chain token + US stock fundamentals. */

const DYNAMIC_URL =
  "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai";

export type RwaDynamic = {
  symbol: string;
  ticker: string;
  token: {
    price: number | null;
    change24h: number | null;
    changePct24h: number | null;
    holders: number | null;
    volume24h: number | null;
    marketCap: number | null;
    circulatingSupply: number | null;
    multiplier: number | null;
  };
  stock: {
    price: number | null;
    high52w: number | null;
    low52w: number | null;
    volume: number | null;
    averageVolume: number | null;
    marketCap: number | null;
    pe: number | null;
    dividendYield: number | null;
    lastCashAmount: number | null;
  };
  status: {
    marketStatus: string | null;
    reasonCode: string | null;
    reasonMsg: string | null;
  };
  limits: {
    maxActiveNotional: number | null;
    maxAttestationCount: number | null;
  };
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchRwaDynamic(
  contractAddress: string,
  chainId = "56",
): Promise<RwaDynamic | null> {
  const url = `${DYNAMIC_URL}?chainId=${chainId}&contractAddress=${contractAddress}`;
  const res = await fetch(url, {
    headers: {
      "Accept-Encoding": "identity",
      "User-Agent": "venue/1.0",
    },
    cache: "no-store",
  });
  const json = (await res.json()) as {
    code?: string;
    success?: boolean;
    data?: {
      symbol?: string;
      ticker?: string;
      tokenInfo?: Record<string, unknown>;
      stockInfo?: Record<string, unknown>;
      statusInfo?: Record<string, unknown>;
      limitInfo?: Record<string, unknown>;
    };
  };

  if (!json.data || (json.code && json.code !== "000000" && !json.success)) {
    return null;
  }

  const d = json.data;
  const t = d.tokenInfo || {};
  const s = d.stockInfo || {};
  const st = d.statusInfo || {};
  const lim = d.limitInfo || {};

  return {
    symbol: String(d.symbol || ""),
    ticker: String(d.ticker || ""),
    token: {
      price: num(t.price),
      change24h: num(t.priceChange24h),
      changePct24h: num(t.priceChangePct24h),
      holders: num(t.totalHolders),
      volume24h: num(t.volume24h),
      marketCap: num(t.marketCap),
      circulatingSupply: num(t.circulatingSupply),
      multiplier: num(t.sharesMultiplier),
    },
    stock: {
      price: num(s.price),
      high52w: num(s.priceHigh52w),
      low52w: num(s.priceLow52w),
      volume: num(s.volume),
      averageVolume: num(s.averageVolume),
      marketCap: num(s.marketCap),
      pe: num(s.priceToEarnings),
      dividendYield: num(s.dividendYield),
      lastCashAmount: num(s.lastCashAmount),
    },
    status: {
      marketStatus: st.marketStatus != null ? String(st.marketStatus) : null,
      reasonCode: st.reasonCode != null ? String(st.reasonCode) : null,
      reasonMsg: st.reasonMsg != null ? String(st.reasonMsg) : null,
    },
    limits: {
      maxActiveNotional: num(lim.maxActiveNotionalValue),
      maxAttestationCount: num(lim.maxAttestationCount),
    },
  };
}
