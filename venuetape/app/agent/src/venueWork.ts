/**
 * OpenVenue Tape work — paid session-aware wrapper recommendation for a ticker.
 * Called from the seller `runWork` hook after ERC-8183 / B402 payment clears.
 */

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

function extractTicker(prompt: string): string {
  const upper = prompt.toUpperCase();
  const known = [
    "NVDA",
    "AAPL",
    "TSLA",
    "META",
    "SPY",
    "AMZN",
    "GOOGL",
    "MSFT",
    "NFLX",
    "COIN",
  ];
  for (const t of known) {
    if (upper.includes(t)) return t;
  }
  const m = upper.match(/\b([A-Z]{1,5})\b/);
  return m?.[1] || "NVDA";
}

function extractAmount(prompt: string): number {
  const m = prompt.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:USDT|USD)?/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 15;
}

export async function resolveVenueTape(
  prompt: string,
): Promise<VenueTapeDeliverable> {
  const ticker = extractTicker(prompt);
  const amount = extractAmount(prompt);
  const base =
    process.env.VENUE_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:3000";

  const qs = new URLSearchParams({
    ticker,
    amount: String(amount),
  });

  const res = await fetch(`${base}/api/venue/resolve?${qs}`);
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    decision?: {
      session: string;
      reason: string;
      bestQuote: {
        candidate: { symbol: string };
        route: { executionMode: string };
      } | null;
      quotes: Array<{
        candidate: {
          kind: string;
          symbol: string;
          contractAddress: string;
          onChainPrice: number | null;
          referencePrice: number | null;
        };
        ok: boolean;
        route?: { executionMode?: string };
      }>;
    };
  };

  if (!json.ok || !json.decision) {
    throw new Error(json.error || "OpenVenue resolve failed");
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
    wrappers: (d.quotes || []).map((q) => ({
      kind: q.candidate.kind,
      symbol: q.candidate.symbol,
      contractAddress: q.candidate.contractAddress,
      onChainPrice: q.candidate.onChainPrice,
      referencePrice: q.candidate.referencePrice,
      quoteOk: q.ok,
      executionMode: q.route?.executionMode,
    })),
  };
}

export function formatVenueTape(d: VenueTapeDeliverable): string {
  const lines = [
    `# OpenVenue Tape — ${d.ticker}`,
    `Generated: ${d.generatedAt}`,
    `Session: ${d.session}`,
    `Recommendation: ${d.recommendation}`,
    `Reason: ${d.reason}`,
    "",
    "## Wrappers",
  ];
  for (const w of d.wrappers) {
    lines.push(
      `- ${w.kind} ${w.symbol} (${w.contractAddress}) · on-chain ${w.onChainPrice ?? "—"} · ref ${w.referencePrice ?? "—"} · quote ${w.quoteOk ? w.executionMode || "ok" : "none"}`,
    );
  }
  lines.push(
    "",
    "_Spot only on BNB Smart Chain. Not financial advice. Re-quote before trading — quoteIds expire (~30s)._",
  );
  return lines.join("\n");
}
