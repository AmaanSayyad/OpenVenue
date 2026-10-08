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
 * Official B402 V2 face for OpenVenue Tape ($0.05 BSC USDT).
 * 1. POST /api/v2/b402/supported (signed with OC_API_KEY)
 * 2. HTTP 402 whose `extra` is copied from kinds[]
 * 3. On PAYMENT-SIGNATURE: verify, then settle, then deliver
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get("ticker") || "NVDA").toUpperCase();
  const amount = Number(url.searchParams.get("amount") || "15");
  const payTo = process.env.B402_PAY_TO || "";

  let supported: Awaited<ReturnType<typeof fetchB402Supported>>;
  try {
    supported = await fetchB402Supported();
  } catch (err) {
    const message = err instanceof Error ? err.message : "supported failed";
    return NextResponse.json(
      { ok: false, module: "b402", step: "supported", error: message },
      { status: 500 },
    );
  }

  if (!b402Ok(supported.code)) {
    return NextResponse.json(
      {
        ok: false,
        module: "b402",
        step: "supported",
        code: supported.code,
        error: supported.msg || "B402 supported failed",
        hint:
          supported.code === "1160401" || supported.code === 1160401
            ? "Complete B402 onboarding on the same Developer Portal project, and tick B402 Payments on the API key."
            : undefined,
      },
      { status: 200 },
    );
  }

  const kind = pickUsdtKind(supported.data?.kinds);
  if (!kind || !payTo) {
    return NextResponse.json(
      {
        ok: false,
        module: "b402",
        step: "supported",
        called: true,
        error: !kind
          ? "No eip155:56 USDT kind in /supported"
          : "Set B402_PAY_TO to the project's write-once receiving address",
        kinds: (supported.data?.kinds || []).length,
      },
      { status: 200 },
    );
  }

  const requirement = tapeRequirement(kind, payTo);
  const challenge = {
    x402Version: 2,
    resource: {
      url: url.origin + url.pathname + url.search,
      description: "OpenVenue Tape resolve",
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

  const payload = paymentPayload as { accepted?: unknown };
  const verify = await verifyB402Payment({
    paymentPayload,
    paymentRequirements: requirement,
  });
  const verifyData = (verify.data || {}) as { isValid?: boolean; invalidReason?: string };
  if (!b402Ok(verify.code) || verifyData.isValid !== true) {
    return NextResponse.json(
      {
        ok: false,
        module: "b402",
        step: "verify",
        code: verify.code,
        error: verify.msg,
        invalidReason: verifyData.invalidReason,
        acceptedMatches:
          JSON.stringify(payload.accepted || null) === JSON.stringify(requirement),
      },
      { status: 402 },
    );
  }

  const method = String(
    (requirement.extra as { assetTransferMethod?: string }).assetTransferMethod || "",
  );
  const settle = await settleB402Payment({
    paymentPayload,
    paymentRequirements: requirement,
    settleAmount: method === "permit2-upto" ? requirement.amount : undefined,
  });
  const settleData = (settle.data || {}) as {
    success?: boolean;
    transaction?: string;
    errorReason?: string;
  };
  if (!b402Ok(settle.code) || settleData.success !== true) {
    return NextResponse.json(
      {
        ok: false,
        module: "b402",
        step: "settle",
        code: settle.code,
        error: settle.msg,
        errorReason: settleData.errorReason,
        transaction: settleData.transaction || null,
      },
      { status: 200 },
    );
  }

  const decision = await resolveVenue({
    ticker,
    amountUsdt: Number.isFinite(amount) && amount > 0 ? amount : 15,
  });

  return NextResponse.json({
    ok: true,
    module: "b402",
    settled: true,
    transaction: settleData.transaction,
    deliverable: {
      ticker,
      session: decision.session,
      reason: decision.reason,
      recommendation: decision.bestQuote
        ? `${decision.bestQuote.candidate.symbol} via ${decision.bestQuote.route.executionMode}`
        : decision.fallback,
    },
  });
}
