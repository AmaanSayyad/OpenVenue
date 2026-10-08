export const BSC_CHAIN_ID = "56";

/** BSC USDT (18 decimals on BSC Binance-peg) */
export const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";

export type WrapperKind = "bstock" | "ondo" | "xstock";

export type SessionState =
  | "open"
  | "pre_market"
  | "after_hours"
  | "closed"
  | "weekend";

export type VenueCandidate = {
  kind: WrapperKind;
  platform: string;
  symbol: string;
  name: string;
  contractAddress: string;
  chainId: string;
  onChainPrice: number | null;
  referencePrice: number | null;
  spreadBps: number | null;
  marketStatus?: string;
  nextOpenTime?: string | null;
  logoUrl?: string | null;
  sectorTabs?: string[];
};

export type QuoteRoute = {
  quoteId: string;
  executionMode: "SWAP" | "RFQ" | string;
  vendorName?: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  estimateGasFee?: string;
  priceImpactPercent?: string;
  approveTarget?: string;
};

export type VenueDecision = {
  ticker: string;
  session: SessionState;
  sessionLabel: string;
  nextUsOpenIso: string;
  candidates: VenueCandidate[];
  recommended: VenueCandidate | null;
  reason: string;
  quotes: Array<{
    candidate: VenueCandidate;
    ok: boolean;
    error?: string;
    route?: QuoteRoute;
    outAmountHuman?: string;
  }>;
  bestQuote: {
    candidate: VenueCandidate;
    route: QuoteRoute;
    outAmountHuman: string;
  } | null;
  fallback: "trade" | "park_defi" | "none";
};

export function wrapperKindFromPlatform(
  platform: string,
  symbol: string,
): WrapperKind {
  const p = platform.toLowerCase();
  const s = symbol.toLowerCase();
  if (p.includes("bstock") || p.includes("b stock") || s.endsWith("b")) {
    if (s.endsWith("on")) return "ondo";
    if (s.endsWith("x")) return "xstock";
    return "bstock";
  }
  if (p.includes("ondo") || s.endsWith("on")) return "ondo";
  if (p.includes("xstock") || p.includes("x stock") || s.endsWith("x"))
    return "xstock";
  return "bstock";
}

export function kindLabel(kind: WrapperKind) {
  switch (kind) {
    case "bstock":
      return "bStocks";
    case "ondo":
      return "Ondo";
    case "xstock":
      return "xStocks";
  }
}
