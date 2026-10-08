import { resolveVenue } from "./router";
import type { VenueDecision } from "./types";
import { getUsEquitySession, sessionPrefersAmm } from "./session";
import { kindLabel } from "./types";

export async function quoteSizeLadder(params: {
  ticker: string;
  sizes: number[];
  wallet?: string;
}): Promise<{
  session: string;
  sessionLabel: string;
  rows: Array<{
    amountUsdt: number;
    ok: boolean;
    symbol?: string;
    kind?: string;
    mode?: string;
    vendor?: string;
    outHuman?: string;
    priceImpactPercent?: string;
    error?: string;
    reason?: string;
  }>;
}> {
  const session = getUsEquitySession();
  const rows = [];
  for (const amountUsdt of params.sizes) {
    try {
      const d = await resolveVenue({
        ticker: params.ticker,
        amountUsdt,
        userWalletAddress: params.wallet,
      });
      if (d.bestQuote) {
        rows.push({
          amountUsdt,
          ok: true,
          symbol: d.bestQuote.candidate.symbol,
          kind: kindLabel(d.bestQuote.candidate.kind),
          mode: d.bestQuote.route.executionMode,
          vendor: d.bestQuote.route.vendorName,
          outHuman: d.bestQuote.outAmountHuman,
          priceImpactPercent: d.bestQuote.route.priceImpactPercent,
          reason: d.reason,
        });
      } else {
        rows.push({
          amountUsdt,
          ok: false,
          error: d.reason,
        });
      }
    } catch (e) {
      rows.push({
        amountUsdt,
        ok: false,
        error: e instanceof Error ? e.message : "ladder failed",
      });
    }
  }
  return {
    session: session.state,
    sessionLabel: session.label,
    rows,
  };
}

export function sessionAutopilot(decision?: VenueDecision | null) {
  const session = getUsEquitySession();
  const prefersAmm = sessionPrefersAmm(session.state);
  const tips: string[] = [];

  if (session.state === "pre_market" || session.state === "after_hours") {
    tips.push(
      "Session tip: prefer SWAP / AMM wrappers now - RFQ depth is thinner outside the US cash open.",
    );
  }
  if (session.state === "open") {
    tips.push(
      "US open: RFQ venues (bStocks / Ondo) often show best size. Compare against AMM before you sign.",
    );
  }
  if (session.state === "weekend" || session.state === "closed") {
    tips.push(
      "Overnight / weekend: route to 24/7 liquidity. At next US open, consider rotating into RFQ-preferred wrappers.",
    );
  }
  if (prefersAmm) {
    tips.push("Autopilot bias: AMM first.");
  } else {
    tips.push("Autopilot bias: RFQ depth first, SWAP as backup.");
  }
  if (decision?.bestQuote) {
    tips.push(
      `Current pick: ${decision.bestQuote.candidate.symbol} via ${decision.bestQuote.route.executionMode}.`,
    );
  }
  if (decision?.fallback === "park_defi") {
    tips.push(
      "No equity quote - park USDT in BSC earn, then unpark when session + liquidity improve.",
    );
  }

  return {
    state: session.state,
    label: session.label,
    nextOpenIso: session.nextOpen.toISOString(),
    prefersAmm,
    tips,
  };
}
