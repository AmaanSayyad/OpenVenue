#!/usr/bin/env node
/**
 * E2E mainnet happy-path (read + quote only by default).
 *
 * Usage:
 *   node scripts/e2e-mainnet.mjs
 *   VENUE_URL=http://127.0.0.1:3000 TICKER=NVDA AMOUNT=15 node scripts/e2e-mainnet.mjs
 *   EXECUTE=1 PRIVATE_KEY=0x… WALLET=0x… node scripts/e2e-mainnet.mjs
 *
 * With EXECUTE=1 the script builds + (optionally) broadcasts a buy via the
 * Venue APIs. Broadcast requires PRIVATE_KEY and is disabled unless
 * BROADCAST=1 is also set - keeps the demo safe by default.
 */

const BASE = process.env.VENUE_URL || "http://127.0.0.1:3000";
const TICKER = (process.env.TICKER || "NVDA").toUpperCase();
const AMOUNT = process.env.AMOUNT || "15";
const WALLET = process.env.WALLET || "";
const EXECUTE = process.env.EXECUTE === "1";
const BROADCAST = process.env.BROADCAST === "1";

function log(step, data) {
  const line =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  console.log(`\n=== ${step} ===\n${line}`);
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `${res.status} ${path}`);
  }
  return json;
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `${res.status} ${path}`);
  }
  return json;
}

async function main() {
  log("config", { BASE, TICKER, AMOUNT, WALLET: WALLET || "(none)", EXECUTE, BROADCAST });

  const session = await get("/api/session");
  log("session", session);

  const qs = new URLSearchParams({ ticker: TICKER, amount: AMOUNT, side: "buy" });
  if (WALLET) qs.set("wallet", WALLET);
  const resolved = await get(`/api/venue/resolve?${qs}`);
  log("resolve", {
    reason: resolved.decision?.reason,
    session: resolved.decision?.session,
    best: resolved.decision?.bestQuote
      ? {
          symbol: resolved.decision.bestQuote.candidate.symbol,
          kind: resolved.decision.bestQuote.candidate.kind,
          mode: resolved.decision.bestQuote.route.executionMode,
          vendor: resolved.decision.bestQuote.route.vendorName,
          out: resolved.decision.bestQuote.outAmountHuman,
          quoteId: resolved.decision.bestQuote.route.quoteId,
        }
      : null,
    fallback: resolved.decision?.fallback,
  });

  const tape = await get(`/api/venue/tape?ticker=${TICKER}&amount=${AMOUNT}`);
  log("tape preview", {
    priceUsd: tape.priceUsd,
    rails: tape.rails,
    recommendation: tape.deliverable?.recommendation,
  });

  if (WALLET) {
    const portfolio = await get(`/api/venue/portfolio?wallet=${WALLET}`);
    log("portfolio", {
      cash: portfolio.portfolio?.cash,
      equityValueUsdt: portfolio.portfolio?.equityValueUsdt,
      positions: (portfolio.portfolio?.positions || []).length,
    });
  }

  const best = resolved.decision?.bestQuote;
  if (!EXECUTE || !best || !WALLET) {
    log("done", "Happy-path quote OK. Set EXECUTE=1 WALLET=0x… to build a buy payload.");
    return;
  }

  const amountWei = BigInt(Math.round(Number(AMOUNT) * 1e18)).toString();
  const built = await post("/api/venue/build", {
    quoteId: best.route.quoteId,
    fromTokenAddress: "0x55d398326f99059fF775485246999027B3197955",
    toTokenAddress: best.candidate.contractAddress,
    amount: amountWei,
    userWalletAddress: WALLET,
    vendor: best.route.vendorName,
    executionMode: best.route.executionMode,
    slippagePercent: "1.5",
    simulate: true,
    requireSimOk: true,
  });
  log("build", {
    executionMode: built.executionMode,
    simOk: built.simOk,
    hasApprove: Boolean(built.approve?.data),
    hasSwapTx: Boolean(built.swap?.tx?.data),
    hasRfq: Boolean(built.swap?.rfq),
  });

  if (!BROADCAST) {
    log(
      "done",
      "Build+sim OK. Set BROADCAST=1 PRIVATE_KEY=… to send (not recommended in CI).",
    );
    return;
  }

  throw new Error(
    "BROADCAST=1 requires a dedicated signer harness - use the /app UI to sign with your wallet for the hack demo.",
  );
}

main().catch((e) => {
  console.error("\nE2E FAILED:", e.message || e);
  process.exit(1);
});
