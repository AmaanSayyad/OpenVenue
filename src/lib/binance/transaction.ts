import { isOcSuccess, ocPost, ocGet } from "./client";
import { BSC_CHAIN_ID } from "../venue/types";

export async function simulateEvmTx(params: {
  from: string;
  to: string;
  data: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
}) {
  const result = await ocPost<Record<string, unknown>>(
    "/api/v1/dex/pre-transaction/simulate",
    {
      binanceChainId: BSC_CHAIN_ID,
      evmTx: {
        from: params.from,
        to: params.to,
        data: params.data,
        value: params.value ?? "0",
        gas: params.gas,
        gasPrice: params.gasPrice,
      },
    },
  );

  if (!isOcSuccess(result)) {
    return { ok: false as const, error: `${result.code}: ${result.msg}` };
  }
  return { ok: true as const, data: result.data };
}

export async function broadcastSignedTx(params: {
  address: string;
  signedTransaction: string;
  enableMevProtection?: boolean;
}) {
  const result = await ocPost<{ txHash?: string; orderId?: string }>(
    "/api/v1/dex/pre-transaction/broadcast-transaction",
    {
      binanceChainId: BSC_CHAIN_ID,
      address: params.address,
      signedTransaction: params.signedTransaction,
      enableMevProtection: params.enableMevProtection ?? true,
    },
  );

  if (!isOcSuccess(result)) {
    return { ok: false as const, error: `${result.code}: ${result.msg}` };
  }
  return { ok: true as const, data: result.data };
}

export async function getTxDetail(txHash: string) {
  return ocGet("/api/v1/dex/post-transaction/transaction-detail-by-txhash", {
    binanceChainId: BSC_CHAIN_ID,
    txHash,
  });
}

export async function getGasPrice() {
  return ocGet("/api/v1/dex/pre-transaction/gas-price", {
    binanceChainId: BSC_CHAIN_ID,
  });
}
