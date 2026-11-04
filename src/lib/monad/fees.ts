/**
 * OpenVenue platform fee settlement on Monad.
 * Fees always go to NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT regardless of where the stock trade executes.
 */
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  parseEther,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import {
  MONAD_MAINNET_ID,
  monadMainnet,
  usdcForChain,
} from "@/lib/monad/chains";
import { openVenueDesk, OPEN_VENUE_DESK_ABI } from "@/lib/monad/contracts";
import {
  PLATFORM_FEE_BPS,
  platformFeeRecipient,
} from "@/lib/venue/issuers";

const client = createPublicClient({
  chain: monadMainnet,
  transport: http(monadMainnet.rpcUrls.default.http[0]),
});

/** Rough MON/USD for fee conversion when paying in native MON */
export function monUsdPrice(): number {
  const raw = process.env.NEXT_PUBLIC_MON_USD;
  const n = raw ? Number(raw) : 0.03;
  return Number.isFinite(n) && n > 0 ? n : 0.03;
}

export function feeUsdFromNotional(notionalUsd: number): number {
  return Math.max(0, notionalUsd * (PLATFORM_FEE_BPS / 10_000));
}

export function feeMonWeiFromNotional(notionalUsd: number): bigint {
  const usd = feeUsdFromNotional(notionalUsd);
  // Floor tiny fees at ~$0.001 so MetaMask still shows a fee hop
  const payUsd = Math.max(usd, 0.001);
  const mon = payUsd / monUsdPrice();
  return parseEther(mon.toFixed(8));
}

export function feeUsdcAtomicFromNotional(notionalUsd: number): bigint {
  const usd = feeUsdFromNotional(notionalUsd);
  return BigInt(Math.round(Math.max(usd, 0.000001) * 1e6));
}

/** Native MON transfer to fee recipient (+ optional desk note). */
export function buildNativeFeeTx(params: {
  notionalUsd: number;
  memo?: string;
}): { to: Address; data?: Hex; value: bigint; chainId: number; recipient: Address } {
  const recipient = platformFeeRecipient();
  const value = feeMonWeiFromNotional(params.notionalUsd);
  return {
    to: recipient,
    value,
    chainId: MONAD_MAINNET_ID,
    recipient,
  };
}

/** Prefer USDC fee when wallet holds enough; else native MON. */
export async function buildPlatformFeeCalls(params: {
  wallet: Address;
  notionalUsd: number;
  ticker: string;
  venue: string;
  side: 0 | 1;
}): Promise<
  Array<{ to: Address; data?: Hex; value?: bigint; chainId: number; kind: string }>
> {
  const recipient = platformFeeRecipient();
  const usdc = usdcForChain(MONAD_MAINNET_ID);
  const usdcFee = feeUsdcAtomicFromNotional(params.notionalUsd);
  const calls: Array<{
    to: Address;
    data?: Hex;
    value?: bigint;
    chainId: number;
    kind: string;
  }> = [];

  let payUsdc = false;
  try {
    const bal = await client.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [params.wallet],
    });
    payUsdc = bal >= usdcFee && usdcFee > 0n;
  } catch {
    payUsdc = false;
  }

  if (payUsdc) {
    calls.push({
      kind: "fee_usdc",
      chainId: MONAD_MAINNET_ID,
      to: usdc,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient, usdcFee],
      }),
      value: 0n,
    });
  } else {
    const native = buildNativeFeeTx({ notionalUsd: params.notionalUsd });
    calls.push({
      kind: "fee_mon",
      chainId: MONAD_MAINNET_ID,
      to: native.to,
      value: native.value,
    });
  }

  // Desk ledger (optional - cheap note on OpenVenueDesk)
  try {
    const desk = openVenueDesk(MONAD_MAINNET_ID);
    const tickerBytes = stringToHex(params.ticker.slice(0, 31), { size: 32 });
    const venueBytes = stringToHex(params.venue.slice(0, 31), { size: 32 });
    calls.push({
      kind: "desk_record",
      chainId: MONAD_MAINNET_ID,
      to: desk,
      data: encodeFunctionData({
        abi: OPEN_VENUE_DESK_ABI,
        functionName: "recordTrade",
        args: [
          tickerBytes,
          venueBytes,
          params.side,
          feeUsdcAtomicFromNotional(params.notionalUsd),
        ],
      }),
      value: 0n,
    });
  } catch {
    /* desk optional */
  }

  return calls;
}

export { PLATFORM_FEE_BPS, platformFeeRecipient };
