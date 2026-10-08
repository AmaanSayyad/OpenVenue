import { isOcSuccess, ocGet, ocPost } from "./client";
import { BSC_CHAIN_ID } from "../venue/types";
import type { VenueCandidate, WrapperKind } from "../venue/types";
import { wrapperKindFromPlatform } from "../venue/types";

type RwaAsset = {
  platformId?: string;
  platform?: string;
  platformName?: string;
  issuancePlatform?: string;
  binanceChainId?: string | number;
  chainId?: string | number;
  tokenContractAddress?: string;
  contractAddress?: string;
  tokenSymbol?: string;
  symbol?: string;
  tokenName?: string;
  name?: string;
  tokenLogoUrl?: string;
  logoUrl?: string;
  tokenPrice?: string | number;
  onChainPrice?: string | number;
  referencePrice?: string | number;
  underlyingPrice?: string | number;
  price?: string | number;
  underlyingTicker?: string;
  assetType?: number | string;
  tags?: string[] | null;
  statusInfo?: {
    marketStatus?: string;
    nextOpenTime?: number | string;
    openState?: boolean;
    reasonCode?: string;
  };
  marketStatus?: string;
  nextOpenTime?: string | number | null;
  sectorTabs?: string[];
};

type RwaSearchHit = {
  ticker?: string;
  companyName?: string;
  assets?: RwaAsset[];
} & RwaAsset;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function chainOf(t: RwaAsset) {
  return String(t.binanceChainId ?? t.chainId ?? "");
}

function addr(t: RwaAsset) {
  return (t.tokenContractAddress || t.contractAddress || "").toLowerCase();
}

function platformOf(t: RwaAsset) {
  return (
    t.platformId ||
    t.platformName ||
    t.platform ||
    t.issuancePlatform ||
    "unknown"
  );
}

function nextOpenIso(v: string | number | null | undefined): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v * 1000;
    return new Date(ms).toISOString();
  }
  const n = Number(v);
  if (Number.isFinite(n) && n > 1e11) {
    return new Date(n > 1e12 ? n : n * 1000).toISOString();
  }
  return String(v);
}

function normalizeCandidate(t: RwaAsset): VenueCandidate | null {
  const contractAddress = addr(t);
  if (!contractAddress) return null;
  const chainId = chainOf(t) || BSC_CHAIN_ID;
  if (chainId !== BSC_CHAIN_ID && chainId !== "56") return null;

  const symbol = t.tokenSymbol || t.symbol || "";
  const platform = platformOf(t);
  const kind = wrapperKindFromPlatform(platform, symbol);
  const onChain =
    num(t.tokenPrice) ?? num(t.onChainPrice) ?? num(t.price);
  const reference = num(t.referencePrice) ?? num(t.underlyingPrice);
  let spreadBps: number | null = null;
  if (onChain != null && reference != null && reference !== 0) {
    spreadBps = ((onChain - reference) / reference) * 10_000;
  }

  const status = t.statusInfo?.marketStatus || t.marketStatus;
  const next =
    nextOpenIso(t.statusInfo?.nextOpenTime) ??
    nextOpenIso(t.nextOpenTime ?? null);

  return {
    kind,
    platform,
    symbol,
    name: t.tokenName || t.name || symbol,
    contractAddress,
    chainId: BSC_CHAIN_ID,
    onChainPrice: onChain,
    referencePrice: reference,
    spreadBps,
    marketStatus: status,
    nextOpenTime: next,
    logoUrl: t.tokenLogoUrl || t.logoUrl || null,
    sectorTabs: t.sectorTabs || t.tags || undefined,
  };
}

function flattenSearchData(data: unknown): RwaAsset[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    const out: RwaAsset[] = [];
    for (const row of data as RwaSearchHit[]) {
      if (Array.isArray(row.assets) && row.assets.length > 0) {
        for (const asset of row.assets) {
          out.push({
            ...asset,
            tokenName: asset.tokenName || row.companyName,
            underlyingTicker: asset.underlyingTicker || row.ticker,
          });
        }
      } else {
        out.push(row);
      }
    }
    return out;
  }
  const obj = data as {
    list?: RwaAsset[];
    tokens?: RwaAsset[];
    data?: RwaAsset[];
    assets?: RwaAsset[];
  };
  if (obj.assets) return obj.assets;
  return obj.list || obj.tokens || obj.data || [];
}

function pickCandidates(ticker: string, tokens: RwaAsset[]): VenueCandidate[] {
  const upper = ticker.toUpperCase();
  const normalized = tokens
    .map(normalizeCandidate)
    .filter((c): c is VenueCandidate => !!c);

  const scored = normalized
    .map((c) => {
      const s = c.symbol.toUpperCase();
      let score = 0;
      if (
        s === upper ||
        s === `${upper}B` ||
        s === `${upper}ON` ||
        s === `${upper}X`
      ) {
        score += 100;
      }
      if (s.startsWith(upper)) score += 40;
      if (s.includes(upper)) score += 20;
      if (c.kind === "bstock") score += 3;
      if (c.kind === "ondo") score += 2;
      if (c.kind === "xstock") score += 1;
      return { c, score };
    })
    .filter((x) => x.score >= 20)
    .sort((a, b) => b.score - a.score);

  const byKind = new Map<WrapperKind, VenueCandidate>();
  for (const { c } of scored) {
    if (!byKind.has(c.kind)) byKind.set(c.kind, c);
  }

  const order: WrapperKind[] = ["bstock", "ondo", "xstock"];
  return order.map((k) => byKind.get(k)).filter((c): c is VenueCandidate => !!c);
}

/** Search RWA tokens by ticker keyword on BSC. */
const rwaSearchCache = new Map<
  string,
  { at: number; rows: Awaited<ReturnType<typeof searchRwaByTickerUncached>> }
>();
const rwaSearchFlight = new Map<
  string,
  Promise<Awaited<ReturnType<typeof searchRwaByTickerUncached>>>
>();

export async function searchRwaByTicker(ticker: string) {
  const q = ticker.trim().toUpperCase();
  const hit = rwaSearchCache.get(q);
  if (hit && Date.now() - hit.at < 120_000) return hit.rows;
  const pending = rwaSearchFlight.get(q);
  if (pending) return pending;
  const job = searchRwaByTickerUncached(q)
    .then((rows) => {
      rwaSearchFlight.delete(q);
      if (rows.length) rwaSearchCache.set(q, { at: Date.now(), rows });
      return rows.length ? rows : hit?.rows ?? rows;
    })
    .catch((err) => {
      rwaSearchFlight.delete(q);
      if (hit) return hit.rows;
      throw err;
    });
  rwaSearchFlight.set(q, job);
  return job;
}

async function searchRwaByTickerUncached(q: string) {
  const result = await ocGet<unknown>("/api/v1/dex/market/rwa/search", {
    keyword: q,
    binanceChainId: BSC_CHAIN_ID,
  });

  if (isOcSuccess(result)) {
    const fromSearch = pickCandidates(q, flattenSearchData(result.data));
    if (fromSearch.length > 0) return fromSearch;
  }

  // Fallback: full BSC token list filtered client-side
  const list = await ocGet<unknown>("/api/v1/dex/market/rwa/tokens", {
    binanceChainId: BSC_CHAIN_ID,
  });
  if (!isOcSuccess(list)) {
    throw new Error(
      (result as { msg?: string }).msg ||
        (list as { msg?: string }).msg ||
        "RWA search failed",
    );
  }
  return pickCandidates(q, flattenSearchData(list.data));
}

/** Enrich candidates with on-chain vs reference prices. */
export async function enrichPrices(candidates: VenueCandidate[]) {
  if (candidates.length === 0) return candidates;

  const joined = candidates.map((c) => c.contractAddress).join(",");
  const priceRes = await ocGet<
    | Array<{
        contractAddress?: string;
        tokenContractAddress?: string;
        tokenPrice?: string | number;
        onChainPrice?: string | number;
        referencePrice?: string | number;
        underlyingPrice?: string | number;
        marketStatus?: string;
        nextOpenTime?: string | number;
        platformId?: string;
      }>
    | { list?: Array<Record<string, unknown>> }
  >("/api/v1/dex/market/rwa/price", {
    binanceChainId: BSC_CHAIN_ID,
    tokenContractAddresses: joined,
  });

  if (!isOcSuccess(priceRes)) return candidates;

  const rows = Array.isArray(priceRes.data)
    ? priceRes.data
    : ((priceRes.data as { list?: Array<Record<string, unknown>> })?.list ?? []);

  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const a = String(
      row.tokenContractAddress || row.contractAddress || "",
    ).toLowerCase();
    if (a) map.set(a, row as Record<string, unknown>);
  }

  return candidates.map((c) => {
    const row = map.get(c.contractAddress);
    if (!row) return c;
    const onChain =
      num(row.tokenPrice) ?? num(row.onChainPrice) ?? c.onChainPrice;
    const reference =
      num(row.referencePrice) ?? num(row.underlyingPrice) ?? c.referencePrice;
    let spreadBps: number | null = null;
    if (onChain != null && reference != null && reference !== 0) {
      spreadBps = ((onChain - reference) / reference) * 10_000;
    }
    return {
      ...c,
      onChainPrice: onChain,
      referencePrice: reference,
      spreadBps,
      marketStatus: (row.marketStatus as string) || c.marketStatus,
      nextOpenTime:
        nextOpenIso(row.nextOpenTime as string | number | undefined) ||
        c.nextOpenTime,
    };
  });
}

export async function getTokenBalances(address: string) {
  return ocGet("/api/v1/dex/balance/all-token-balances-by-address", {
    binanceChainId: BSC_CHAIN_ID,
    walletAddress: address,
    address,
  });
}

export async function postTokenPrices(
  tokens: Array<{ binanceChainId: string; contractAddress: string }>,
) {
  return ocPost("/api/v1/dex/market/price", { tokens });
}
