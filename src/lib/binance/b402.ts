import { ocPost } from "./client";
import { USDT_BSC } from "@/lib/venue/types";

/** $0.05 of 18-decimal BSC USDT, atomic units. */
export const TAPE_PRICE_ATOMIC = "50000000000000000";

export type B402Kind = {
  scheme?: string;
  network?: string;
  asset?: string;
  extra?: Record<string, unknown>;
};

type SupportedEnvelope = {
  code?: string | number;
  msg?: string;
  data?: { kinds?: B402Kind[] };
};

export function b402Ok(code: string | number | undefined) {
  return code === 0 || code === "0" || code === "000000000";
}

/** Live facilitator config. `extra` must be copied verbatim into the 402. */
export async function fetchB402Supported() {
  const result = await ocPost<SupportedEnvelope["data"]>(
    "/api/v2/b402/supported",
    { body: {} },
  );
  return result as SupportedEnvelope;
}

export function pickUsdtKind(kinds: B402Kind[] | undefined) {
  const list = kinds || [];
  const usdt = list.filter(
    (k) =>
      k.network === "eip155:56" &&
      k.asset?.toLowerCase() === USDT_BSC.toLowerCase(),
  );
  return (
    usdt.find((k) => k.extra?.assetTransferMethod === "permit2-exact") ||
    usdt.find((k) => k.scheme === "exact") ||
    usdt[0] ||
    null
  );
}

export function tapeRequirement(kind: B402Kind, payTo: string) {
  return {
    scheme: kind.scheme || "exact",
    network: "eip155:56",
    amount: TAPE_PRICE_ATOMIC,
    asset: USDT_BSC,
    payTo,
    maxTimeoutSeconds: 300,
    extra: kind.extra || {},
  };
}

export async function verifyB402Payment(input: {
  paymentPayload: unknown;
  paymentRequirements: unknown;
}) {
  return ocPost<Record<string, unknown>>("/api/v2/b402/verify", {
    body: {
      x402Version: 2,
      paymentPayload: input.paymentPayload,
      paymentRequirements: input.paymentRequirements,
    },
  });
}

export async function settleB402Payment(input: {
  paymentPayload: unknown;
  paymentRequirements: unknown;
  settleAmount?: string;
}) {
  const inner: Record<string, unknown> = {
    x402Version: 2,
    paymentPayload: input.paymentPayload,
    paymentRequirements: input.paymentRequirements,
  };
  if (input.settleAmount) inner.settleAmount = input.settleAmount;
  return ocPost<Record<string, unknown>>("/api/v2/b402/settle", { body: inner });
}
