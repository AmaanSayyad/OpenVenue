import {
  MONAD_MAINNET_ID,
  defaultChainId,
  usdcForChain,
} from "@/lib/monad/chains";
import {
  PLATFORM_FEE_BPS,
  referencePrice,
  searchVenues,
  type IssuerId,
  type VenueListing,
} from "@/lib/venue/issuers";
import { quotePancake } from "@/lib/bsc/pancake";
import { getUsEquitySession, sessionPrefersAmm } from "./session";
import type { QuoteRoute, VenueCandidate, VenueDecision, WrapperKind } from "./types";
import { kindLabel, networkLabel } from "./types";

function issuerToKind(issuer: IssuerId): WrapperKind {
  if (issuer === "xstocks") return "xstock";
  if (issuer === "bstocks") return "bstock";
  if (issuer === "ondo") return "ondo";
  return "anchored";
}

function toCandidate(listing: VenueListing): VenueCandidate {
  const ref = referencePrice(listing.underlying);
  const onChain = ref * (1 + listing.spreadBps / 10_000);
  return {
    kind: issuerToKind(listing.issuer),
    platform: listing.platform,
    symbol: listing.symbol,
    name: listing.name,
    contractAddress: listing.contractAddress,
    chainId: String(listing.executionChainId),
    executionChainId: listing.executionChainId,
    quoteToken: listing.quoteToken,
    quoteDecimals: listing.quoteDecimals,
    onChainPrice: onChain,
    referencePrice: ref,
    spreadBps: listing.spreadBps,
    liveOnMonad: listing.live && listing.executionChainId === MONAD_MAINNET_ID,
    live: listing.live,
    liquidity: listing.liquidity,
    hours: listing.hours,
    notes: listing.notes,
    marketStatus: listing.live ? "live" : "coming_soon",
  };
}

function usdcToAtomic(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * 10 ** decimals));
}

function atomicToHuman(atomic: string, decimals = 18): string {
  const n = Number(atomic) / 10 ** decimals;
  return n.toFixed(6).replace(/\.?0+$/, "") || "0";
}

async function buildRoute(
  candidate: VenueCandidate,
  amountUsdc: number,
  prefersAmm: boolean,
): Promise<QuoteRoute | null> {
  if (!candidate.live) return null;
  if (!candidate.onChainPrice || candidate.onChainPrice <= 0) return null;
  if (
    !candidate.contractAddress ||
    candidate.contractAddress === "0x0000000000000000000000000000000000000000"
  ) {
    return null;
  }

  const feeBps = PLATFORM_FEE_BPS;
  // Venue fill uses full notional; OpenVenue fee is a separate Monad hop
  const fee = amountUsdc * (feeBps / 10_000);
  const decimals = candidate.quoteDecimals ?? 18;
  const quoteToken = (candidate.quoteToken || usdcForChain(defaultChainId())) as `0x${string}`;
  const inAtomic = usdcToAtomic(amountUsdc, decimals);
  const feeAtomic = usdcToAtomic(fee, decimals);

  let outAtomic = BigInt(Math.round((amountUsdc / candidate.onChainPrice) * 1e18));
  let vendorName = `${candidate.platform} · chain ${candidate.executionChainId}`;

  // Live Pancake quote when executing on BSC
  if (candidate.executionChainId === 56 && inAtomic > 0n) {
    try {
      const q = await quotePancake({
        tokenIn: quoteToken,
        tokenOut: candidate.contractAddress as `0x${string}`,
        amountIn: inAtomic,
      });
      if (q.ok) {
        outAtomic = q.amountOut;
        vendorName = `${candidate.platform} · PancakeSwap BSC`;
      }
    } catch {
      /* keep synthetic */
    }
  }

  const mode: "SWAP" | "RFQ" =
    candidate.hours === "24/7" || prefersAmm ? "SWAP" : "SWAP";

  return {
    quoteId: `ov-${candidate.symbol}-${Date.now()}`,
    executionMode: mode,
    vendorName,
    fromTokenAmount: inAtomic.toString(),
    toTokenAmount: outAtomic.toString(),
    estimateGasFee: candidate.executionChainId === 56 ? "0.0003" : "0.002",
    priceImpactPercent: ((candidate.spreadBps || 0) / 100).toFixed(3),
    approveTarget: quoteToken,
    platformFeeAtomic: feeAtomic.toString(),
    platformFeeBps: feeBps,
    executionChainId: candidate.executionChainId,
  };
}

function scoreCandidate(
  c: VenueCandidate,
  route: QuoteRoute | undefined,
  prefersAmm: boolean,
) {
  if (!route || !c.live) return -1;
  let score = 0;
  const mode = route.executionMode.toUpperCase();
  if (prefersAmm) {
    if (mode === "SWAP") score += 50;
  } else {
    if (mode === "SWAP") score += 40;
  }
  score += (c.liquidity || 50);
  score -= Math.min(Math.abs(c.spreadBps || 0) / 5, 40);
  // Prefer liquid BSC bStocks over thin Monad Anchored for fills
  if (c.kind === "bstock") score += 25;
  if (c.kind === "xstock") score += 10;
  if (c.kind === "ondo") score += 8;
  if (c.kind === "anchored") score += 4;
  try {
    score += Number(BigInt(route.toTokenAmount) / BigInt("1000000000000"));
  } catch {
    /* ignore */
  }
  return score;
}

export async function resolveVenue(params: {
  ticker: string;
  amountUsdt: number;
  userWalletAddress?: string;
  side?: "buy" | "sell";
  fromTokenAmountWei?: string;
  fromTokenAddress?: string;
}): Promise<VenueDecision> {
  const session = getUsEquitySession();
  const prefersAmm = sessionPrefersAmm(session.state);
  const ticker = params.ticker.trim().toUpperCase();
  const side = params.side || "buy";
  const homeChainId = defaultChainId();
  const amount = Number.isFinite(params.amountUsdt) ? params.amountUsdt : 15;

  const listings = searchVenues(ticker);
  let candidates = listings.map(toCandidate);

  if (side === "sell" && params.fromTokenAddress) {
    const addr = params.fromTokenAddress.toLowerCase();
    const hit = candidates.find((c) => c.contractAddress.toLowerCase() === addr);
    if (hit) candidates = [hit];
  }

  const quotes: VenueDecision["quotes"] = [];

  for (const candidate of candidates) {
    if (!candidate.live) {
      quotes.push({
        candidate,
        ok: false,
        error: candidate.notes || "Venue not live yet",
      });
      continue;
    }

    const route = await buildRoute(candidate, amount, prefersAmm);
    if (!route) {
      quotes.push({
        candidate,
        ok: false,
        error: "No executable route right now",
      });
      continue;
    }

    quotes.push({
      candidate,
      ok: true,
      route,
      outAmountHuman: atomicToHuman(route.toTokenAmount, 18),
    });
  }

  let best: VenueDecision["bestQuote"] = null;
  let bestScore = -Infinity;
  for (const q of quotes) {
    if (!q.ok || !q.route) continue;
    const s = scoreCandidate(q.candidate, q.route, prefersAmm);
    if (s > bestScore) {
      bestScore = s;
      best = {
        candidate: q.candidate,
        route: q.route,
        outAmountHuman: q.outAmountHuman || atomicToHuman(q.route.toTokenAmount, 18),
      };
    }
  }

  let reason: string;
  let fallback: VenueDecision["fallback"] = "none";

  if (best) {
    const chainLabel =
      best.candidate.executionChainId === 56
        ? "BNB Chain (MetaMask will switch)"
        : "Monad";
    reason =
      side === "sell"
        ? `Best exit: ${best.candidate.symbol} → quote via ${best.route.vendorName} on ${chainLabel}. Platform fee ${PLATFORM_FEE_BPS} bps settles on Monad.`
        : `Best path: buy ${ticker} via ${kindLabel(best.candidate.kind)} (${best.candidate.symbol}) on ${chainLabel}. Compared ${candidates.length} venues · fee ${PLATFORM_FEE_BPS} bps on Monad. ${session.label}`;
    fallback = "trade";
  } else if (candidates.some((c) => c.live)) {
    reason = `Found live wrappers for ${ticker}, but no quote. Retry with a smaller size.`;
    fallback = "none";
  } else if (candidates.length > 0) {
    reason = `${ticker} issuers are registered, but no live executable venue right now.`;
    fallback = "none";
  } else {
    reason = `No venue match for “${ticker}”. Try NVDA, AAPL, TSLA, META, or SPY.`;
    fallback = "none";
  }

  return {
    ticker,
    session: session.state,
    sessionLabel: session.label,
    nextUsOpenIso: session.nextOpen.toISOString(),
    network: networkLabel(homeChainId),
    chainId: best?.candidate.executionChainId ?? homeChainId,
    quoteAsset: "USDC",
    candidates,
    recommended:
      best?.candidate ?? candidates.find((c) => c.live) ?? candidates[0] ?? null,
    reason,
    quotes,
    bestQuote: best,
    fallback,
  };
}

export function activeUsdc(): `0x${string}` {
  return usdcForChain(defaultChainId());
}

export function isMainnet(): boolean {
  return defaultChainId() === MONAD_MAINNET_ID;
}
