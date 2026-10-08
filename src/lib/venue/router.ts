import { enrichPrices, searchRwaByTicker } from "../binance/rwa";
import {
  getAggregatedQuote,
  toHuman,
  USDT_BSC,
} from "../binance/trading";
import { usdtAmountToWei } from "./amount";
import { getUsEquitySession, sessionPrefersAmm } from "./session";
import type { VenueCandidate, VenueDecision, QuoteRoute } from "./types";
import { kindLabel } from "./types";

function scoreCandidate(
  c: VenueCandidate,
  route: QuoteRoute | undefined,
  prefersAmm: boolean,
) {
  let score = 0;
  if (!route) return -1;

  const mode = route.executionMode.toUpperCase();
  if (prefersAmm) {
    if (mode === "SWAP") score += 50;
    if (mode === "RFQ") score += 10;
    if (c.kind === "xstock") score += 20;
    if (c.kind === "bstock") score += 15;
    if (c.kind === "ondo") score += 5;
  } else {
    if (mode === "RFQ") score += 40;
    if (mode === "SWAP") score += 30;
    if (c.kind === "bstock") score += 20;
    if (c.kind === "ondo") score += 15;
    if (c.kind === "xstock") score += 10;
  }

  try {
    score += Number(BigInt(route.toTokenAmount) / BigInt("100000000000000"));
  } catch {
    /* ignore */
  }

  if (c.spreadBps != null) {
    score -= Math.min(Math.abs(c.spreadBps) / 10, 30);
  }

  return score;
}

function pickRoute(routes: QuoteRoute[], prefersAmm: boolean) {
  const sorted = [...routes].sort((a, b) => {
    const am = a.executionMode.toUpperCase();
    const bm = b.executionMode.toUpperCase();
    if (prefersAmm) {
      if (am === "SWAP" && bm !== "SWAP") return -1;
      if (bm === "SWAP" && am !== "SWAP") return 1;
    }
    try {
      return BigInt(b.toTokenAmount) > BigInt(a.toTokenAmount) ? 1 : -1;
    } catch {
      return 0;
    }
  });
  return sorted[0];
}

export async function resolveVenue(params: {
  ticker: string;
  amountUsdt: number;
  userWalletAddress?: string;
  /** buy = USDT→stock (default), sell = stock→USDT */
  side?: "buy" | "sell";
  /** Required for sell: exact token wei amount */
  fromTokenAmountWei?: string;
  fromTokenAddress?: string;
}): Promise<VenueDecision> {
  const session = getUsEquitySession();
  const prefersAmm = sessionPrefersAmm(session.state);
  const ticker = params.ticker.trim().toUpperCase();
  const side = params.side || "buy";

  let candidates = await searchRwaByTicker(ticker);
  candidates = await enrichPrices(candidates);

  // Sell path targeting a specific wrapper
  if (side === "sell" && params.fromTokenAddress) {
    const addr = params.fromTokenAddress.toLowerCase();
    const hit = candidates.find((c) => c.contractAddress === addr);
    if (hit) candidates = [hit];
    else if (candidates.length === 0) {
      candidates = [
        {
          kind: "bstock",
          platform: "unknown",
          symbol: ticker,
          name: ticker,
          contractAddress: addr,
          chainId: "56",
          onChainPrice: null,
          referencePrice: null,
          spreadBps: null,
        },
      ];
    }
  }

  const amountWei =
    side === "sell" && params.fromTokenAmountWei
      ? params.fromTokenAmountWei
      : usdtAmountToWei(params.amountUsdt).toString();

  const quotes: VenueDecision["quotes"] = [];

  for (const candidate of candidates) {
    const quoted = await getAggregatedQuote({
      fromTokenAddress:
        side === "sell" ? candidate.contractAddress : USDT_BSC,
      toTokenAddress: side === "sell" ? USDT_BSC : candidate.contractAddress,
      amount: amountWei,
      userWalletAddress: params.userWalletAddress,
    });

    if (!quoted.ok || quoted.routes.length === 0) {
      quotes.push({
        candidate,
        ok: false,
        error: quoted.ok ? "No routes returned" : quoted.error,
      });
      continue;
    }

    const route = pickRoute(quoted.routes, prefersAmm);
    quotes.push({
      candidate,
      ok: true,
      route,
      outAmountHuman: toHuman(route.toTokenAmount),
    });
  }

  const viable = quotes.filter((q) => q.ok && q.route);
  let best: VenueDecision["bestQuote"] = null;
  let bestScore = -Infinity;

  for (const q of viable) {
    const s = scoreCandidate(q.candidate, q.route, prefersAmm);
    if (s > bestScore && q.route) {
      bestScore = s;
      best = {
        candidate: q.candidate,
        route: q.route,
        outAmountHuman: q.outAmountHuman || toHuman(q.route.toTokenAmount),
      };
    }
  }

  let reason: string;
  let fallback: VenueDecision["fallback"] = "none";

  if (best) {
    const mode = best.route.executionMode.toUpperCase();
    reason =
      side === "sell"
        ? `Exit ${best.candidate.symbol} → USDT via ${mode}${
            best.route.vendorName ? ` / ${best.route.vendorName}` : ""
          }. ${session.label}`
        : `Route ${ticker} via ${kindLabel(best.candidate.kind)} (${best.candidate.symbol}) using ${mode}${
            best.route.vendorName ? ` / ${best.route.vendorName}` : ""
          }. ${session.label}`;
    fallback = "trade";
  } else if (candidates.length > 0) {
    reason = `Found ${candidates.length} wrapper(s) for ${ticker}, but no live quote right now (${session.state}). Park idle USDT in BSC DeFi until a venue reopens, or retry with a smaller size.`;
    fallback = "park_defi";
  } else {
    reason = `No bStocks / Ondo / xStocks match for “${ticker}” on BSC. Try NVDA, AAPL, TSLA, META, or SPY.`;
    fallback = "none";
  }

  return {
    ticker,
    session: session.state,
    sessionLabel: session.label,
    nextUsOpenIso: session.nextOpen.toISOString(),
    candidates,
    recommended: best?.candidate ?? candidates[0] ?? null,
    reason,
    quotes,
    bestQuote: best,
    fallback,
  };
}
