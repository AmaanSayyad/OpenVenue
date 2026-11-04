import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  type Address,
  type PublicClient,
} from "viem";
import { bsc } from "viem/chains";
import {
  defaultChainId,
  monadMainnet,
  monadTestnet,
  MONAD_MAINNET_ID,
  usdcForChain,
  USDC_DECIMALS,
  BSC_CHAIN_ID,
} from "@/lib/monad/chains";
import { CORE_UNDERLYINGS, referencePrice, searchMonadVenues } from "@/lib/monad/venues";
import { USDT_ON_BSC, wrapperKindFromPlatform, type WrapperKind } from "@/lib/venue/types";
import { searchRwaByTicker } from "./rwa";

export const CORE_TICKERS = [...CORE_UNDERLYINGS];

export type TrackedWrapper = {
  ticker: string;
  address: string;
  symbol?: string;
  kind?: string;
  platform?: string;
  chainId: number;
};

/** Live issuer wrappers across Monad + BSC — used for portfolio + sell discovery. */
export function allTrackedWrappers(): TrackedWrapper[] {
  const out: TrackedWrapper[] = [];
  const seen = new Set<string>();
  for (const t of CORE_UNDERLYINGS) {
    for (const v of searchMonadVenues(t)) {
      if (!v.live) continue;
      if (!v.contractAddress || /^0x0{40}$/i.test(v.contractAddress)) continue;
      const key = `${v.executionChainId}:${v.contractAddress.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ticker: t,
        address: v.contractAddress,
        symbol: v.symbol,
        kind: v.issuer,
        platform: v.platform,
        chainId: v.executionChainId,
      });
    }
  }
  return out;
}

/** @deprecated use allTrackedWrappers() — kept so older imports keep compiling */
export const TRACKED_WRAPPERS: TrackedWrapper[] = [];

function chainFor(chainId?: number) {
  const id = chainId ?? defaultChainId();
  if (id === BSC_CHAIN_ID) return bsc;
  return id === MONAD_MAINNET_ID ? monadMainnet : monadTestnet;
}

function clientFor(chainId?: number): PublicClient {
  const chain = chainFor(chainId);
  const rpc =
    chain.id === BSC_CHAIN_ID
      ? process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org"
      : chain.rpcUrls.default.http[0];
  return createPublicClient({
    chain,
    transport: http(rpc, { timeout: 12_000 }),
  });
}

/** Rough MON/USD for portfolio display - MetaMask-aligned ballpark. */
export async function fetchMonUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd",
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return 0.02;
    const data = (await res.json()) as { monad?: { usd?: number } };
    return data.monad?.usd && data.monad.usd > 0 ? data.monad.usd : 0.02;
  } catch {
    return 0.02;
  }
}

export async function buildPortfolio(params: {
  wallet: string;
  contracts: Array<{
    address: string;
    symbol?: string;
    ticker?: string;
    kind?: string;
    platform?: string;
    chainId?: number;
  }>;
  chainId?: number;
}) {
  // Home cash always on Monad; stock wrappers may live on BSC or Monad.
  const homeChainId = MONAD_MAINNET_ID;
  const home = clientFor(homeChainId);
  const bscClient = clientFor(BSC_CHAIN_ID);
  const wallet = params.wallet as Address;
  const usdc = usdcForChain(homeChainId);
  const monUsd = await fetchMonUsdPrice();

  const [nativeWei, usdcWei, bscUsdtWei] = await Promise.all([
    home.getBalance({ address: wallet }),
    home
      .readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
      })
      .catch(() => 0n),
    bscClient
      .readContract({
        address: USDT_ON_BSC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
      })
      .catch(() => 0n),
  ]);

  const nativeHuman = formatUnits(nativeWei, 18);
  const usdcHuman = formatUnits(usdcWei, USDC_DECIMALS);
  const bscUsdtHuman = formatUnits(bscUsdtWei, 18);
  const nativeValue = Number(nativeHuman) * monUsd;
  const usdcValue = Number(usdcHuman);

  const positions: Array<{
    symbol: string;
    ticker: string;
    contractAddress: string;
    balance: string;
    balanceWei: string;
    onChainPrice: number | null;
    valueUsdt: number | null;
    kind?: WrapperKind;
    platform?: string;
    chainId: number;
  }> = [];

  const candidates = params.contracts.filter((c) =>
    /^0x[a-fA-F0-9]{40}$/.test(c.address),
  );

  if (candidates.length) {
    const results = await Promise.all(
      candidates.map(async (c) => {
        const execChain = c.chainId ?? homeChainId;
        const client = execChain === BSC_CHAIN_ID ? bscClient : home;
        try {
          const bal = await client.readContract({
            address: c.address as Address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [wallet],
          });
          return { c, bal, execChain, client };
        } catch {
          return { c, bal: 0n, execChain, client };
        }
      }),
    );

    for (const { c, bal, execChain, client } of results) {
      if (bal === 0n) continue;
      let decimals = 18;
      let symbol = c.symbol || "TOKEN";
      try {
        const [d, s] = await Promise.all([
          client.readContract({
            address: c.address as Address,
            abi: erc20Abi,
            functionName: "decimals",
          }),
          client.readContract({
            address: c.address as Address,
            abi: erc20Abi,
            functionName: "symbol",
          }),
        ]);
        decimals = Number(d);
        symbol = s || symbol;
      } catch {
        /* keep defaults */
      }
      const human = formatUnits(bal, decimals);
      const ticker = (
        c.ticker || symbol.replace(/(on|x|B)$/i, "").replace(/^a/i, "")
      ).toUpperCase();
      const px = referencePrice(ticker);
      const kind =
        (c.kind as WrapperKind | undefined) ||
        wrapperKindFromPlatform(c.platform || "", symbol);
      positions.push({
        symbol,
        ticker,
        contractAddress: c.address,
        balance: human,
        balanceWei: bal.toString(),
        onChainPrice: px,
        valueUsdt: Number(human) * px,
        kind,
        platform: c.platform,
        chainId: execChain,
      });
    }
  }

  const equityValueUsdt = positions.reduce(
    (sum, p) => sum + (p.valueUsdt || 0),
    0,
  );
  const totalValueUsdt = usdcValue + nativeValue + equityValueUsdt;

  return {
    wallet: params.wallet,
    chainId: homeChainId,
    chain: "monad",
    cash: {
      usdt: usdcHuman,
      usdc: usdcHuman,
      bscUsdt: bscUsdtHuman,
      bnb: nativeHuman, // legacy key - UI maps to MON
      mon: nativeHuman,
    },
    monUsd,
    positions,
    equityValueUsdt,
    totalValueUsdt,
    cashUsdc: usdcValue,
    holdings: positions.map((p) => ({
      symbol: p.symbol,
      address: p.contractAddress,
      balance: p.balance,
      usdValue: p.valueUsdt,
      chainId: p.chainId,
    })),
    tracked: params.contracts.length,
  };
}

export async function discoverContractsForTickers(tickers: string[]) {
  const out: Array<{
    address: string;
    symbol: string;
    ticker: string;
    kind?: string;
    platform?: string;
  }> = [];
  const seen = new Set<string>();
  for (const t of tickers) {
    const cands = await searchRwaByTicker(t);
    for (const c of cands.filter((x) => x.live || x.liveOnMonad)) {
      if (seen.has(c.contractAddress.toLowerCase())) continue;
      // Skip synthetic demo addresses until real issuer contracts ship
      if (!c.contractAddress || c.contractAddress.startsWith("0x0000")) continue;
      seen.add(c.contractAddress.toLowerCase());
      out.push({
        address: c.contractAddress,
        symbol: c.symbol,
        ticker: t,
        kind: c.kind,
        platform: c.platform,
      });
    }
  }
  return out;
}

export async function fetchGasSnapshot(chainId?: number) {
  const client = clientFor(chainId);
  try {
    const gas = await client.getGasPrice();
    const g = gas.toString();
    return {
      slow: g,
      medium: g,
      fast: ((gas * 12n) / 10n).toString(),
      unit: "wei",
      chain: "monad",
      chainId: chainId ?? defaultChainId(),
    };
  } catch {
    return {
      slow: "1000000000",
      medium: "1500000000",
      fast: "2000000000",
      unit: "wei",
      chain: "monad",
      chainId: chainId ?? defaultChainId(),
    };
  }
}

export async function getAllowance(
  wallet: string,
  token: string,
  spender: string,
  chainId?: number,
) {
  const client = clientFor(chainId);
  try {
    return await client.readContract({
      address: token as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [wallet as Address, spender as Address],
    });
  } catch {
    return 0n;
  }
}

export async function getNativeAndUsdt(wallet: string, chainId?: number) {
  const id = chainId ?? defaultChainId();
  const client = clientFor(id);
  const usdc = usdcForChain(id);
  const [nativeWei, usdcWei] = await Promise.all([
    client.getBalance({ address: wallet as Address }),
    client
      .readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet as Address],
      })
      .catch(() => 0n),
  ]);
  return {
    wallet,
    native: formatUnits(nativeWei, 18),
    nativeWei: nativeWei.toString(),
    nativeSymbol: "MON",
    usdt: formatUnits(usdcWei, USDC_DECIMALS),
    usdc: formatUnits(usdcWei, USDC_DECIMALS),
    chain: id === MONAD_MAINNET_ID ? "monad" : "monad-testnet",
    chainId: id,
  };
}
