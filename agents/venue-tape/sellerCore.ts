/**
 * Venue Tape - BNB Agent Studio seller core (drop into a `bag init` project).
 *
 * What it sells: a paid session-aware venue recommendation for a ticker
 * (bStocks vs Ondo vs xStocks), meant to be exposed over x402 / ERC-8183.
 *
 * Scaffold with:
 *   bag init venue-tape --network bsc-mainnet
 * then replace app/agent/src/sellerCore.ts with this module's runWork logic
 * (or import resolveVenue from the Venue app package).
 */

export type VenueTapeInput = {
  ticker: string;
  amountUsdt?: number;
  wallet?: string;
};

export type VenueTapeDeliverable = {
  ticker: string;
  generatedAt: string;
  session: string;
  recommendation: string;
  reason: string;
  wrappers: Array<{
    kind: string;
    symbol: string;
    contractAddress: string;
    onChainPrice: number | null;
    referencePrice: number | null;
    quoteOk: boolean;
    executionMode?: string;
  }>;
};

export async function runWork(input: VenueTapeInput): Promise<VenueTapeDeliverable> {
  const ticker = (input.ticker || "NVDA").toUpperCase();
  const amount = input.amountUsdt ?? 15;
  const base =
    process.env.VENUE_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:3000";

  const qs = new URLSearchParams({
    ticker,
    amount: String(amount),
  });
  if (input.wallet) qs.set("wallet", input.wallet);

  const res = await fetch(`${base}/api/venue/resolve?${qs}`);
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "Venue resolve failed");
  }

  const d = json.decision;
  return {
    ticker,
    generatedAt: new Date().toISOString(),
    session: d.session,
    recommendation: d.bestQuote
      ? `${d.bestQuote.candidate.symbol} via ${d.bestQuote.route.executionMode}`
      : "none",
    reason: d.reason,
    wrappers: (d.quotes || []).map(
      (q: {
        candidate: {
          kind: string;
          symbol: string;
          contractAddress: string;
          onChainPrice: number | null;
          referencePrice: number | null;
        };
        ok: boolean;
        route?: { executionMode?: string };
      }) => ({
        kind: q.candidate.kind,
        symbol: q.candidate.symbol,
        contractAddress: q.candidate.contractAddress,
        onChainPrice: q.candidate.onChainPrice,
        referencePrice: q.candidate.referencePrice,
        quoteOk: q.ok,
        executionMode: q.route?.executionMode,
      }),
    ),
  };
}
