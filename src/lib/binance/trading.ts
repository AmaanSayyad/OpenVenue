import { isOcSuccess, ocGet } from "./client";
import { BSC_CHAIN_ID, type QuoteRoute } from "../venue/types";
import { toHumanAmount, USDT_BSC, usdtAmountToWei } from "../venue/amount";

const toHuman = toHumanAmount;

function parseRoute(raw: Record<string, unknown>): QuoteRoute | null {
  const quoteId = String(raw.quoteId || raw.quoteID || "");
  if (!quoteId && !raw.executionMode) return null;
  return {
    quoteId,
    executionMode: String(raw.executionMode || "SWAP").toUpperCase(),
    vendorName: raw.vendorName ? String(raw.vendorName) : undefined,
    fromTokenAmount: String(raw.fromTokenAmount || raw.fromAmount || ""),
    toTokenAmount: String(raw.toTokenAmount || raw.toAmount || ""),
    estimateGasFee: raw.estimateGasFee ? String(raw.estimateGasFee) : undefined,
    priceImpactPercent: raw.priceImpactPercent
      ? String(raw.priceImpactPercent)
      : undefined,
    approveTarget: raw.approveTarget ? String(raw.approveTarget) : undefined,
  };
}

export async function getAggregatedQuote(params: {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  userWalletAddress?: string;
}) {
  const result = await ocGet<
    | {
        quoteList?: Array<Record<string, unknown>>;
        routes?: Array<Record<string, unknown>>;
        dexRouterList?: Array<Record<string, unknown>>;
      }
    | Array<Record<string, unknown>>
  >("/api/v1/dex/aggregator/quote", {
    binanceChainId: BSC_CHAIN_ID,
    fromTokenAddress: params.fromTokenAddress,
    toTokenAddress: params.toTokenAddress,
    amount: params.amount,
    userWalletAddress: params.userWalletAddress,
  });

  if (!isOcSuccess(result)) {
    return {
      ok: false as const,
      error: `${result.code}: ${result.msg}`,
      routes: [] as QuoteRoute[],
    };
  }

  const data = result.data;
  const list = Array.isArray(data)
    ? data
    : data?.quoteList || data?.routes || data?.dexRouterList || [];

  const routes = (list as Array<Record<string, unknown>>)
    .map(parseRoute)
    .filter((r): r is QuoteRoute => !!r && !!r.quoteId);

  return { ok: true as const, routes, raw: result.data };
}

export async function buildSwap(params: {
  quoteId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  userWalletAddress: string;
  slippagePercent?: string;
  vendor?: string;
}) {
  const result = await ocGet<Record<string, unknown>>(
    "/api/v1/dex/aggregator/swap",
    {
      binanceChainId: BSC_CHAIN_ID,
      quoteId: params.quoteId,
      fromTokenAddress: params.fromTokenAddress,
      toTokenAddress: params.toTokenAddress,
      amount: params.amount,
      userWalletAddress: params.userWalletAddress,
      slippagePercent: params.slippagePercent ?? "1",
      vendor: params.vendor,
    },
  );

  if (!isOcSuccess(result)) {
    return { ok: false as const, error: `${result.code}: ${result.msg}` };
  }
  return { ok: true as const, data: result.data };
}

export type ApproveTx = {
  to: string;
  data: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
  dexContractAddress?: string;
};

/** Normalize Binance approve payload (often missing `to`; `to` is the token). */
export function normalizeApproveTx(
  raw: unknown,
  tokenContractAddress: string,
): ApproveTx | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const data = r.data ? String(r.data) : "";
  if (!data || data === "0x") return null;
  return {
    to: String(r.to || tokenContractAddress),
    data,
    value: r.value ? String(r.value) : "0",
    gas: r.gas || r.gasLimit ? String(r.gas || r.gasLimit) : undefined,
    gasPrice: r.gasPrice ? String(r.gasPrice) : undefined,
    dexContractAddress: r.dexContractAddress
      ? String(r.dexContractAddress)
      : undefined,
  };
}

export async function getApproveTx(params: {
  tokenContractAddress: string;
  approveAmount: string;
  vendor?: string;
}) {
  const result = await ocGet<Array<Record<string, unknown>> | Record<string, unknown>>(
    "/api/v1/dex/aggregator/approve-transaction",
    {
      binanceChainId: BSC_CHAIN_ID,
      tokenContractAddress: params.tokenContractAddress,
      approveAmount: params.approveAmount,
      vendor: params.vendor,
    },
  );
  if (!isOcSuccess(result)) {
    return { ok: false as const, error: `${result.code}: ${result.msg}` };
  }
  const normalized = normalizeApproveTx(result.data, params.tokenContractAddress);
  return { ok: true as const, data: normalized, raw: result.data };
}

export { toHuman, USDT_BSC, usdtAmountToWei };
