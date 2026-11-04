import { NextResponse } from "next/server";
import { resolveVenue } from "@/lib/venue/router";
import {
  b402Ok,
  fetchB402Supported,
  pickUsdtKind,
  settleB402Payment,
  tapeRequirement,
  verifyB402Payment,
} from "@/lib/binance/b402";
import { defaultChainId } from "@/lib/monad/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodePayment(header: string): unknown | null {
  const trimmed = header.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith("{")) return JSON.parse(trimmed);
    return JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Monad x402 face for OpenVenue Tape ($0.05 USDC on Monad).
 * Agents pay → receive best venue recommendation for a ticker.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") || "NVDA").toUpperCase();
  const amount = Number(url.searchParams.get("amount") || "15");
  const payTo =
    process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT ||
    "0xe9BEa05Fc2927d1A2Ef6BD59B1d492d42965896e";

  let supported: Awaited<ReturnType<typeof fetchB402Supported>>;
  try {
    supported = await fetchB402Supported();
  } catch (err) {
    const message = err instanceof Error ? err.message : "supported failed";
    return NextResponse.json(
      { ok: false, module: "x402", network: `eip155:${defaultChainId()}`, error: message },
      { status: 500 },
    );
  }

  const kind = pickUsdtKind(supported.data?.kinds);
  if (!kind) {
    return NextResponse.json(
      {
        ok: false,
        module: "x402",
        error: "No Monad USDC payment kind configured",
        chainId: defaultChainId(),
      },
      { status: 200 },
    );
  }

  const requirement = tapeRequirement(kind, payTo);
  const challenge = {
    x402Version: 2,
    resource: {
      url: url.origin + url.pathname + url.search,
      description: "OpenVenue Tape - best Monad venue for tokenized stock",
      mimeType: "application/json",
    },
    accepts: [requirement],
  };

  const paymentHeader =
    req.headers.get("payment-signature") || req.headers.get("x-payment") || "";
  const paymentPayload = decodePayment(paymentHeader);

  if (!paymentPayload) {
    const encoded = Buffer.from(JSON.stringify(challenge)).toString("base64");
    return NextResponse.json(challenge, {
      status: 402,
      headers: { "PAYMENT-REQUIRED": encoded },
    });
  }

  const verify = await verifyB402Payment({
    paymentPayload,
    paymentRequirements: requirement,
  });
  const verifyData = (verify.data || {}) as { isValid?: boolean; invalidReason?: string };
  if (!b402Ok(verify.code) || verifyData.isValid !== true) {
    return NextResponse.json(
      {
        ok: false,
        module: "x402",
        step: "verify",
        error: verify.msg,
        invalidReason: verifyData.invalidReason,
      },
      { status: 402 },
    );
  }

  const settle = await settleB402Payment({
    paymentPayload,
    paymentRequirements: requirement,
  });
  const settleData = (settle.data || {}) as {
    success?: boolean;
    transaction?: string;
    errorReason?: string;
  };

  const decision = await resolveVenue({
    ticker,
    amountUsdt: Number.isFinite(amount) && amount > 0 ? amount : 15,
  });

  return NextResponse.json({
    ok: true,
    module: "x402",
    network: `eip155:${defaultChainId()}`,
    settled: settleData.success === true,
    transaction: settleData.transaction,
    deliverable: {
      ticker,
      session: decision.session,
      reason: decision.reason,
      recommendation: decision.bestQuote
        ? `${decision.bestQuote.candidate.symbol} via ${decision.bestQuote.route.executionMode} on Monad`
        : decision.fallback,
      feeBps: decision.bestQuote?.route.platformFeeBps,
    },
  });
}
