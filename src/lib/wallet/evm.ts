import type { Address, Hex } from "viem";
import { BSC_CHAIN_ID, MONAD_MAINNET_ID, MONAD_TESTNET_ID } from "@/lib/monad/chains";

type Eip1193 = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

function injected(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
  return eth ?? null;
}

function toHexChainId(id: number): `0x${string}` {
  return `0x${id.toString(16)}`;
}

function addChainParams(chainId: number) {
  if (chainId === MONAD_MAINNET_ID) {
    return {
      chainId: toHexChainId(MONAD_MAINNET_ID),
      chainName: "Monad",
      nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
      rpcUrls: ["https://rpc.monad.xyz"],
      blockExplorerUrls: ["https://monadvision.com"],
    };
  }
  if (chainId === MONAD_TESTNET_ID) {
    return {
      chainId: toHexChainId(MONAD_TESTNET_ID),
      chainName: "Monad Testnet",
      nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
      rpcUrls: ["https://testnet-rpc.monad.xyz"],
      blockExplorerUrls: ["https://testnet.monadvision.com"],
    };
  }
  if (chainId === BSC_CHAIN_ID) {
    return {
      chainId: toHexChainId(BSC_CHAIN_ID),
      chainName: "BNB Smart Chain",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: ["https://bsc-dataseed.binance.org"],
      blockExplorerUrls: ["https://bscscan.com"],
    };
  }
  throw new Error(`Unsupported chain ${chainId}`);
}

export async function readInjectedChainId(): Promise<number | null> {
  const provider = injected();
  if (!provider) return null;
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  return Number(hex);
}

/** Switch MetaMask via EIP-1193 — avoids wagmi connector.getChainId bugs after AppKit reconnect. */
export async function ensureInjectedChain(targetId: number): Promise<void> {
  const provider = injected();
  if (!provider) throw new Error("No wallet found. Connect MetaMask and try again.");

  const current = await readInjectedChainId();
  if (current === targetId) return;

  const chainId = toHexChainId(targetId);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    // 4902 = unknown chain; some wallets surface this as -32603
    if (code === 4902 || code === -32603) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [addChainParams(targetId)],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
      return;
    }
    throw err;
  }
}

export async function sendInjectedTransaction(tx: {
  to: Address;
  data?: Hex;
  value?: bigint;
  chainId?: number;
}): Promise<Hex> {
  const provider = injected();
  if (!provider) throw new Error("No wallet found. Connect MetaMask and try again.");

  if (tx.chainId != null) {
    await ensureInjectedChain(tx.chainId);
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const from = accounts[0] as Address | undefined;
  if (!from) throw new Error("Connect a wallet first.");

  const hash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: tx.to,
        data: tx.data,
        value:
          tx.value != null && tx.value > 0n
            ? (`0x${tx.value.toString(16)}` as Hex)
            : undefined,
      },
    ],
  })) as Hex;

  return hash;
}

export function isConnectorChainIdBug(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /getChainId is not a function/i.test(msg);
}
