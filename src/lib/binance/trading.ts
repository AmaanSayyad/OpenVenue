/**
 * Quote + swap builder.
 * - Liquid Monad path: Uniswap V3 MON ↔ USDC
 * - Tokenized stocks on BSC: PancakeSwap V2 (bStocks / Ondo / xStocks)
 * Platform fees settle separately on Monad.
 */
import { defaultChainId, usdcForChain } from "@/lib/monad/chains";
import { PLATFORM_FEE_BPS } from "@/lib/venue/issuers";
import {
  buildPancakeApprove,
  buildPancakeSwap,
  isBscUsdt,
  needsPancakeAllowance,
} from "@/lib/bsc/pancake";
import {
  buildUniswapApprove,
  buildUniswapSwap,
  isLiquidMonadPair,
  needsAllowance,
  WMON,
} from "@/lib/monad/uniswap";
import { toHumanAmount, usdtAmountToWei } from "../venue/amount";
import type { QuoteRoute } from "../venue/types";

export const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955" as const;
export const USDC_MONAD = usdcForChain(defaultChainId());
export const toHuman = toHumanAmount;

function looksLikeBscStockSwap(from: string, to: string) {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  const usdt = USDT_BSC.toLowerCase();
  return f === usdt || t === usdt;
}

export async function getAggregatedQuote(params: {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  userWalletAddress?: string;
}) {
  const route: QuoteRoute = {
    quoteId: `ov-${Date.now()}`,
    executionMode: "SWAP",
    vendorName: isLiquidMonadPair(params.fromTokenAddress, params.toTokenAddress)
      ? "Uniswap V3"
      : looksLikeBscStockSwap(params.fromTokenAddress, params.toTokenAddress)
        ? "PancakeSwap BSC"
        : "OpenVenue",
    fromTokenAmount: params.amount,
    toTokenAmount: params.amount,
    estimateGasFee: "0.002",
    priceImpactPercent: "0.05",
    approveTarget: params.fromTokenAddress,
    platformFeeBps: PLATFORM_FEE_BPS,
  };
  return { ok: true as const, routes: [route], raw: { chainId: defaultChainId() } };
}

export async function buildSwap(params: {
  quoteId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  userWalletAddress: string;
  slippagePercent?: string;
  vendor?: string;
  executionChainId?: number;
}) {
  if (isLiquidMonadPair(params.fromTokenAddress, params.toTokenAddress)) {
    const built = await buildUniswapSwap(params);
    if (!built.ok) {
      return { ok: false as const, error: built.error };
    }
    return {
      ok: true as const,
      data: {
        ...built.data,
        quoteId: params.quoteId || built.data.quoteId,
        fromTokenAddress: params.fromTokenAddress,
        toTokenAddress: params.toTokenAddress,
        amount: params.amount,
        userWalletAddress: params.userWalletAddress,
        chainId: defaultChainId(),
      },
    };
  }

  // BSC stock venues (bStocks / Ondo / xStocks) or explicit chain 56
  if (
    params.executionChainId === 56 ||
    looksLikeBscStockSwap(params.fromTokenAddress, params.toTokenAddress)
  ) {
    const built = await buildPancakeSwap(params);
    if (!built.ok) return { ok: false as const, error: built.error };
    return {
      ok: true as const,
      data: {
        ...built.data,
        quoteId: params.quoteId || built.data.quoteId,
      },
    };
  }

  return {
    ok: false as const,
    error:
      "No live swap path for this pair. Pick a bStocks / Ondo / xStocks venue (BSC) or MON ↔ USDC on Monad.",
  };
}

export async function buildApproveTransaction(params: {
  tokenContractAddress: string;
  amount?: string;
  executionChainId?: number;
}) {
  const token = params.tokenContractAddress.toLowerCase();
  const usdc = usdcForChain(defaultChainId()).toLowerCase();

  if (params.executionChainId === 56 || isBscUsdt(params.tokenContractAddress)) {
    return buildPancakeApprove(params);
  }

  if (token === usdc || token === WMON.toLowerCase()) {
    const built = await buildUniswapApprove(params);
    if (!built.ok) return { ok: false as const, error: "approve failed" };
    if (built.skip || !built.data) {
      return { ok: true as const, data: null, skip: true as const };
    }
    return { ok: true as const, data: built.data };
  }

  // Stock token sell on BSC
  if (params.executionChainId === 56) {
    return buildPancakeApprove(params);
  }

  return {
    ok: false as const,
    error: "Approve not available for this token/chain",
  };
}

export async function getApproveTx(params: {
  tokenContractAddress: string;
  approveAmount?: string;
  amount?: string;
  vendor?: string;
  userWalletAddress?: string;
  executionChainId?: number;
}) {
  void params.vendor;
  const amount = params.approveAmount || params.amount;
  const built = await buildApproveTransaction({
    tokenContractAddress: params.tokenContractAddress,
    amount,
    executionChainId: params.executionChainId,
  });

  if (
    built.ok &&
    params.userWalletAddress &&
    amount &&
    !("skip" in built && built.skip)
  ) {
    if (params.executionChainId === 56 || isBscUsdt(params.tokenContractAddress)) {
      const pending = await needsPancakeAllowance({
        token: params.tokenContractAddress,
        owner: params.userWalletAddress,
        amount: BigInt(amount),
      });
      return { ...built, allowancePending: pending };
    }
    const pending = await needsAllowance({
      token: params.tokenContractAddress,
      owner: params.userWalletAddress,
      amount: BigInt(amount),
    });
    return { ...built, allowancePending: pending };
  }

  return { ...built, allowancePending: false };
}

export { usdtAmountToWei, toHumanAmount, WMON, needsPancakeAllowance };
