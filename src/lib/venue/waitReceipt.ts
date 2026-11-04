import { createPublicClient, http, type Hex } from "viem";
import { bsc } from "viem/chains";
import {
  BSC_CHAIN_ID,
  monadMainnet,
  monadTestnet,
  MONAD_MAINNET_ID,
  MONAD_TESTNET_ID,
} from "@/lib/monad/chains";

/** Wait for a tx on the venue chain (BSC fill or Monad) without depending on the wallet's active chain. */
export async function waitVenueReceipt(hash: Hex, chainId: number) {
  const client =
    chainId === BSC_CHAIN_ID
      ? createPublicClient({
          chain: bsc,
          transport: http("https://bsc-dataseed.binance.org"),
        })
      : createPublicClient({
          chain: chainId === MONAD_TESTNET_ID ? monadTestnet : monadMainnet,
          transport: http(
            chainId === MONAD_TESTNET_ID
              ? monadTestnet.rpcUrls.default.http[0]
              : monadMainnet.rpcUrls.default.http[0],
          ),
        });

  return client.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });
}

export function isMonadChain(chainId: number): boolean {
  return chainId === MONAD_MAINNET_ID || chainId === MONAD_TESTNET_ID;
}
