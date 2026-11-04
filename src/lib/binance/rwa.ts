/**
 * Venue discovery across live issuers (BSC + Monad).
 */
import {
  listExploreMarkets,
  referencePrice,
  searchVenues,
  type IssuerId,
} from "@/lib/venue/issuers";
import type { VenueCandidate, WrapperKind } from "../venue/types";

function issuerToKind(issuer: IssuerId): WrapperKind {
  if (issuer === "xstocks") return "xstock";
  if (issuer === "bstocks") return "bstock";
  if (issuer === "ondo") return "ondo";
  return "anchored";
}

export async function searchRwaByTicker(
  ticker: string,
): Promise<VenueCandidate[]> {
  return searchVenues(ticker).map((l) => {
    const ref = referencePrice(l.underlying);
    return {
      kind: issuerToKind(l.issuer),
      platform: l.platform,
      symbol: l.symbol,
      name: l.name,
      contractAddress: l.contractAddress,
      chainId: String(l.executionChainId),
      executionChainId: l.executionChainId,
      quoteToken: l.quoteToken,
      quoteDecimals: l.quoteDecimals,
      onChainPrice: ref * (1 + l.spreadBps / 10_000),
      referencePrice: ref,
      spreadBps: l.spreadBps,
      liveOnMonad: l.live && l.executionChainId === 143,
      live: l.live,
      liquidity: l.liquidity,
      hours: l.hours,
      notes: l.notes,
      marketStatus: l.live ? "live" : "coming_soon",
    };
  });
}

export async function enrichPrices(
  candidates: VenueCandidate[],
): Promise<VenueCandidate[]> {
  return candidates.map((c) => {
    const ref = c.referencePrice ?? referencePrice(c.symbol);
    const spread = c.spreadBps ?? 10;
    return {
      ...c,
      referencePrice: ref,
      onChainPrice: ref * (1 + spread / 10_000),
    };
  });
}

export async function listRwaTokens() {
  return listExploreMarkets().map((m) => ({
    ticker: m.ticker,
    referencePrice: m.referencePrice,
    venuesLive: m.venues,
    venuesTotal: m.totalVenues,
    chain: "multi",
  }));
}
