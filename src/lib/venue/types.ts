import {
  MONAD_MAINNET_ID,
  MONAD_TESTNET_ID,
  USDC_MAINNET,
  USDC_TESTNET,
  defaultChainId,
  usdcForChain,
} from "@/lib/monad/chains";

export const MONAD_CHAIN_ID = String(defaultChainId());
export const REAL_BSC_CHAIN_ID = 56;

/** Preferred quote asset: Circle USDC on the active Monad network */
export const USDC_MONAD = usdcForChain(defaultChainId());
/** @deprecated legacy alias - Monad USDC (not BNB Chain USDT) */
export const USDT_BSC = USDC_MONAD;
/** Binance-peg USDT on BNB Chain (18 decimals) - stock venue quote asset */
export const USDT_ON_BSC =
  "0x55d398326f99059fF775485246999027B3197955" as const;
export const USDC_ADDRESSES = {
  [MONAD_MAINNET_ID]: USDC_MAINNET,
  [MONAD_TESTNET_ID]: USDC_TESTNET,
} as const;

export type WrapperKind = "anchored" | "xstock" | "ondo" | "bstock";

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
  /** Chain MetaMask must be on to execute the stock swap */
  executionChainId?: number;
  quoteToken?: string;
  quoteDecimals?: number;
  onChainPrice: number | null;
  referencePrice: number | null;
  spreadBps: number | null;
  marketStatus?: string;
  nextOpenTime?: string | null;
  logoUrl?: string | null;
  sectorTabs?: string[];
  liveOnMonad?: boolean;
  /** Executable somewhere (BSC / Monad / …) */
  live?: boolean;
  liquidity?: number;
  hours?: "24/7" | "us_equity";
  notes?: string;
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
  /** OpenVenue platform fee in quote-token atomic units */
  platformFeeAtomic?: string;
  platformFeeBps?: number;
  executionChainId?: number;
};

export type VenueDecision = {
  ticker: string;
  session: SessionState;
  sessionLabel: string;
  nextUsOpenIso: string;
  network: "monad-mainnet" | "monad-testnet";
  chainId: number;
  quoteAsset: "USDC" | "USDT";
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

export function kindLabel(kind: WrapperKind): string {
  switch (kind) {
    case "anchored":
      return "Anchored";
    case "xstock":
      return "xStocks";
    case "ondo":
      return "Ondo";
    case "bstock":
      return "bStocks";
  }
}

export function wrapperKindFromPlatform(
  platform: string,
  symbol: string,
): WrapperKind {
  const p = platform.toLowerCase();
  const s = symbol.toLowerCase();
  if (p.includes("anchored") || s.endsWith("a")) return "anchored";
  if (p.includes("xstock") || p.includes("x stock") || s.endsWith("x"))
    return "xstock";
  if (p.includes("ondo") || s.endsWith("on")) return "ondo";
  if (p.includes("bstock") || p.includes("b stock") || s.endsWith("b"))
    return "bstock";
  return "anchored";
}

export function networkLabel(chainId: number): "monad-mainnet" | "monad-testnet" {
  return chainId === MONAD_MAINNET_ID ? "monad-mainnet" : "monad-testnet";
}
