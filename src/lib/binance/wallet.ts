import { createPublicClient, http, formatEther, formatUnits, parseAbi } from "viem";
import { bsc } from "viem/chains";
import { BSC_CHAIN_ID, USDT_BSC, type WrapperKind } from "../venue/types";
import { wrapperKindFromPlatform } from "../venue/types";
import { enrichPrices } from "./rwa";
import { getGasPrice } from "./transaction";
import { isOcSuccess } from "./client";

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const client = createPublicClient({
  chain: bsc,
  transport: http("https://bsc-dataseed.binance.org"),
});

/** Seed list - portfolio route also discovers wrappers via RWA search. */
export const TRACKED_WRAPPERS: Array<{
  address: string;
  symbol: string;
  ticker: string;
  kind: WrapperKind;
  platform: string;
}> = [
  {
    address: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436",
    symbol: "NVDAB",
    ticker: "NVDA",
    kind: "bstock",
    platform: "bstock",
  },
  {
    address: "0xa9ee28c80f960b889dfbd1902055218cba016f75",
    symbol: "NVDAon",
    ticker: "NVDA",
    kind: "ondo",
    platform: "ondo",
  },
];

export const CORE_TICKERS = [
  "NVDA",
  "AAPL",
  "TSLA",
  "META",
  "SPY",
  "AMZN",
  "GOOGL",
  "MSFT",
];

export async function getNativeAndUsdt(wallet: string) {
  const address = wallet as `0x${string}`;
  const [bnb, usdt] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({
      address: USDT_BSC as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);
  return {
    bnb: formatEther(bnb),
    bnbWei: bnb.toString(),
    usdt: formatUnits(usdt, 18),
    usdtWei: usdt.toString(),
  };
}

export async function getTokenBalance(wallet: string, token: string) {
  const bal = await client.readContract({
    address: token as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet as `0x${string}`],
  });
  return bal;
}

export async function getAllowance(
  wallet: string,
  token: string,
  spender: string,
) {
  return client.readContract({
    address: token as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [wallet as `0x${string}`, spender as `0x${string}`],
  });
}

export async function fetchGasSnapshot() {
  const res = await getGasPrice();
  if (!isOcSuccess(res)) {
    return { ok: false as const, error: res.msg, mediumGwei: null };
  }
  const data = res.data as {
    evmLegacyGasPrice?: {
      lowGasPrice?: string;
      mediumGasPrice?: string;
      highGasPrice?: string;
    };
  };
  const medium = data?.evmLegacyGasPrice?.mediumGasPrice;
  const mediumGwei = medium ? Number(medium) / 1e9 : null;
  return {
    ok: true as const,
    low: data?.evmLegacyGasPrice?.lowGasPrice ?? null,
    medium: medium ?? null,
    high: data?.evmLegacyGasPrice?.highGasPrice ?? null,
    mediumGwei,
  };
}

export type PortfolioPosition = {
  kind: WrapperKind;
  platform: string;
  symbol: string;
  ticker: string;
  contractAddress: string;
  balance: string;
  balanceWei: string;
  onChainPrice: number | null;
  referencePrice: number | null;
  spreadBps: number | null;
  valueUsdt: number | null;
};

export async function buildPortfolio(params: {
  wallet: string;
  contracts: Array<{
    address: string;
    symbol: string;
    ticker: string;
    kind: WrapperKind;
    platform: string;
  }>;
}) {
  const cash = await getNativeAndUsdt(params.wallet);
  const positions: PortfolioPosition[] = [];

  for (const c of params.contracts) {
    try {
      const wei = await getTokenBalance(params.wallet, c.address);
      if (wei === 0n) continue;
      const human = formatUnits(wei, 18);
      positions.push({
        kind: c.kind,
        platform: c.platform,
        symbol: c.symbol,
        ticker: c.ticker,
        contractAddress: c.address.toLowerCase(),
        balance: human,
        balanceWei: wei.toString(),
        onChainPrice: null,
        referencePrice: null,
        spreadBps: null,
        valueUsdt: null,
      });
    } catch {
      /* skip bad contract */
    }
  }

  if (positions.length > 0) {
    const enriched = await enrichPrices(
      positions.map((p) => ({
        kind: p.kind,
        platform: p.platform,
        symbol: p.symbol,
        name: p.symbol,
        contractAddress: p.contractAddress,
        chainId: BSC_CHAIN_ID,
        onChainPrice: null,
        referencePrice: null,
        spreadBps: null,
      })),
    );
    const map = new Map(enriched.map((e) => [e.contractAddress, e]));
    for (const p of positions) {
      const e = map.get(p.contractAddress);
      if (!e) continue;
      p.onChainPrice = e.onChainPrice;
      p.referencePrice = e.referencePrice;
      p.spreadBps = e.spreadBps;
      if (e.onChainPrice != null) {
        p.valueUsdt = Number(p.balance) * e.onChainPrice;
      }
    }
  }

  const equityValue = positions.reduce((s, p) => s + (p.valueUsdt || 0), 0);
  const gas = await fetchGasSnapshot();

  return {
    wallet: params.wallet,
    cash,
    positions,
    equityValueUsdt: equityValue,
    totalValueUsdt: equityValue + Number(cash.usdt),
    gas,
  };
}

export { wrapperKindFromPlatform };
