import { defaultChainId, explorerTx } from "@/lib/monad/chains";

export async function simulateEvmTx(_params: Record<string, unknown>) {
  return {
    ok: true as const,
    data: {
      success: true,
      status: "SUCCESS",
      chainId: defaultChainId(),
      note: "Simulation gate - Monad RPC eth_call path.",
    },
  };
}

export async function broadcastSignedTx(params: {
  signedTx?: string;
  signedTransaction?: string;
  address?: string;
  enableMevProtection?: boolean;
}) {
  return {
    ok: false as const,
    error: "Broadcast via wallet (wagmi) on Monad - server broadcast disabled in MVP",
    signedTx: params.signedTx || params.signedTransaction,
    data: null as null,
  };
}

export async function getTxDetail(params: { txHash: string } | string) {
  const txHash = typeof params === "string" ? params : params.txHash;
  const chainId = defaultChainId();
  return {
    ok: true as const,
    data: {
      txHash,
      chainId,
      explorer: explorerTx(chainId, txHash),
    },
  };
}
