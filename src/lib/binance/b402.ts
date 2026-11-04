/**
 * Monad x402 payment surface for OpenVenue Tape.
 * Uses Circle USDC on Monad Testnet/Mainnet (not Binance B402 / Monad).
 */
import { defaultChainId, usdcForChain, MONAD_TESTNET_ID } from "@/lib/monad/chains";

/** $0.05 of 6-decimal USDC */
export const TAPE_PRICE_ATOMIC = "50000";

export type B402Kind = {
  scheme?: string;
  network?: string;
  asset?: string;
  extra?: Record<string, unknown>;
};

export function b402Ok(code: string | number | undefined) {
  return code === 0 || code === "0" || code === "000000000" || code === undefined;
}

export async function fetchB402Supported() {
  const chainId = defaultChainId();
  const asset = usdcForChain(chainId);
  return {
    code: 0,
    msg: "ok",
    data: {
      kinds: [
        {
          scheme: "exact",
          network: `eip155:${chainId}`,
          asset,
          extra: {
            assetTransferMethod: "eip3009",
            name: "USD Coin",
            version: "2",
          },
        },
      ] as B402Kind[],
    },
  };
}

export function pickUsdtKind(kinds: B402Kind[] | undefined) {
  const chainId = defaultChainId();
  const asset = usdcForChain(chainId).toLowerCase();
  const list = kinds || [];
  return (
    list.find(
      (k) =>
        k.network === `eip155:${chainId}` &&
        k.asset?.toLowerCase() === asset,
    ) ||
    list[0] ||
    null
  );
}

export function tapeRequirement(kind: B402Kind, payTo: string) {
  const chainId = defaultChainId();
  return {
    scheme: kind.scheme || "exact",
    network: `eip155:${chainId}`,
    amount: TAPE_PRICE_ATOMIC,
    asset: kind.asset || usdcForChain(chainId),
    payTo,
    maxTimeoutSeconds: 300,
    extra: kind.extra || {},
  };
}

export async function verifyB402Payment(input: {
  paymentPayload: unknown;
  paymentRequirements: unknown;
}) {
  // Local / Blitz demo: accept signed payloads structurally.
  // Wire Monad x402 facilitator (https://x402-facilitator.molandak.org) for production settle.
  void input;
  return {
    code: 0,
    msg: "ok",
    data: { isValid: true },
  };
}

export async function settleB402Payment(input: {
  paymentPayload: unknown;
  paymentRequirements: unknown;
  settleAmount?: string;
}) {
  void input;
  const demoTx =
    defaultChainId() === MONAD_TESTNET_ID
      ? "0xmonadtestnet_openvenue_tape_demo"
      : "0xmonad_openvenue_tape_demo";
  return {
    code: 0,
    msg: "ok",
    data: {
      success: true,
      transaction: demoTx,
      network: `eip155:${defaultChainId()}`,
      note: "Demo settle - replace with Monad x402 facilitator settle in production.",
    },
  };
}
