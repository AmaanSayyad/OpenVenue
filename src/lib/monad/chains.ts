import { defineChain } from "viem";

/** Monad Mainnet - chain id 143 */
export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.monad.xyz", "https://rpc1.monad.xyz"],
      webSocket: ["wss://rpc.monad.xyz", "wss://rpc1.monad.xyz"],
    },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://monadvision.com" },
    monadscan: { name: "Monadscan", url: "https://monadscan.com" },
  },
  testnet: false,
});

/** Monad Testnet - chain id 10143 */
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://testnet-rpc.monad.xyz"],
      webSocket: ["wss://testnet-rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadVision Testnet",
      url: "https://testnet.monadvision.com",
    },
    monadscan: {
      name: "Monadscan Testnet",
      url: "https://testnet.monadscan.com",
    },
  },
  testnet: true,
});

export const MONAD_MAINNET_ID = 143;
export const MONAD_TESTNET_ID = 10143;

/** Circle USDC on Monad Mainnet */
export const USDC_MAINNET =
  "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as const;

/** Circle USDC on Monad Testnet */
export const USDC_TESTNET =
  "0x534b2f3A21130d7a60830c2Df862319e593943A3" as const;

export const USDC_DECIMALS = 6;

export function usdcForChain(chainId: number): `0x${string}` {
  return chainId === MONAD_MAINNET_ID ? USDC_MAINNET : USDC_TESTNET;
}

/** BNB Smart Chain - bStocks / Ondo / xStocks execution */
export const BSC_CHAIN_ID = 56;

export function explorerTx(chainId: number, hash: string): string {
  if (chainId === BSC_CHAIN_ID) {
    return `https://bscscan.com/tx/${hash}`;
  }
  if (chainId === MONAD_MAINNET_ID) {
    return `https://monadvision.com/tx/${hash}`;
  }
  return `https://testnet.monadvision.com/tx/${hash}`;
}

export function explorerName(chainId: number): string {
  if (chainId === BSC_CHAIN_ID) return "BscScan";
  if (chainId === MONAD_MAINNET_ID) return "MonadVision";
  return "MonadVision Testnet";
}

export function chainLabel(chainId: number): string {
  if (chainId === BSC_CHAIN_ID) return "BNB Chain";
  if (chainId === MONAD_MAINNET_ID) return "Monad";
  return "Monad Testnet";
}

export function defaultChainId(): number {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (raw === "143") return MONAD_MAINNET_ID;
  return MONAD_TESTNET_ID;
}
