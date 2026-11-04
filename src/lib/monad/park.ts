/**
 * Park idle USDC into Monad lending / earn venues.
 * Primary executable path: Aave V3 USDC supply.
 */
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  maxUint256,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { MONAD_MAINNET_ID, USDC_MAINNET, monadMainnet } from "@/lib/monad/chains";

export const AAVE_POOL =
  "0x69a5F9AD4f96ebf0a0C792dD42a01cC5C0102fef" as const;
export const AAVE_A_USDC =
  "0x35a73BAcb179d3740395A3ceCc87FF2e581d6042" as const;
export const PARK_USDC = USDC_MAINNET;

const AAVE_POOL_ID = "aave-v3-usdc";

/** Local logos fetched from DefiLlama protocol icons. */
const PROTOCOL_LOGOS: Record<string, string> = {
  "aave-v3": "/brand/logos/park/aave-v3.png",
  accountable: "/brand/logos/park/accountable.png",
  curvance: "/brand/logos/park/curvance.png",
  "morpho-blue": "/brand/logos/park/morpho-blue.png",
  "euler-v2": "/brand/logos/park/euler-v2.png",
  neverland: "/brand/logos/park/neverland.png",
};

function protocolLogoFor(project: string): string | undefined {
  return PROTOCOL_LOGOS[project] || PROTOCOL_LOGOS[project.toLowerCase()];
}

const poolAbi = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  "function getReserveAToken(address asset) view returns (address)",
]);

const client = createPublicClient({
  chain: monadMainnet,
  transport: http(monadMainnet.rpcUrls.default.http[0]),
});

export type ParkItem = {
  investmentId: string;
  protocolName: string;
  protocolLogo?: string;
  poolName: string;
  apyDisplay: string;
  apy: number;
  tvlUsd: number | null;
  executable: boolean;
  notes?: string;
  chainId: number;
  asset: `0x${string}`;
  aToken?: `0x${string}`;
  pool?: `0x${string}`;
};

export type ParkCall = {
  to: string;
  data: string;
  value?: string;
  callDataType: "APPROVE" | "DEPOSIT" | "WITHDRAW";
  chainId: number;
};

async function fetchLlamaApy(): Promise<{ apy: number; tvlUsd: number | null }> {
  try {
    const res = await fetch("https://yields.llama.fi/pools", {
      next: { revalidate: 300 },
    } as RequestInit);
    const json = (await res.json()) as {
      data?: Array<{
        chain?: string;
        project?: string;
        symbol?: string;
        apy?: number;
        tvlUsd?: number;
      }>;
    };
    const hit = (json.data || []).find(
      (p) =>
        (p.chain || "").toLowerCase() === "monad" &&
        (p.project || "") === "aave-v3" &&
        (p.symbol || "").toUpperCase() === "USDC",
    );
    if (hit) {
      return {
        apy: Number(hit.apy) || 0,
        tvlUsd: hit.tvlUsd != null ? Number(hit.tvlUsd) : null,
      };
    }
  } catch {
    /* fall through */
  }
  return { apy: 4.5, tvlUsd: null };
}

async function fetchExtraUsdcPools(): Promise<ParkItem[]> {
  try {
    const res = await fetch("https://yields.llama.fi/pools", {
      next: { revalidate: 300 },
    } as RequestInit);
    const json = (await res.json()) as {
      data?: Array<{
        pool?: string;
        chain?: string;
        project?: string;
        symbol?: string;
        apy?: number;
        tvlUsd?: number;
      }>;
    };
    const allow = new Set([
      "morpho-blue",
      "curvance",
      "euler-v2",
      "neverland",
      "accountable",
    ]);
    const rows = (json.data || [])
      .filter(
        (p) =>
          (p.chain || "").toLowerCase() === "monad" &&
          allow.has(p.project || "") &&
          (p.symbol || "").toUpperCase() === "USDC" &&
          Number(p.tvlUsd || 0) >= 50_000,
      )
      .sort((a, b) => Number(b.apy || 0) - Number(a.apy || 0))
      .slice(0, 5)
      .map((p) => {
        const apy = Number(p.apy) || 0;
        const project = p.project || "venue";
        const name =
          project
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ") || "Venue";
        return {
          investmentId: `view-${p.pool}`,
          protocolName: name,
          protocolLogo: protocolLogoFor(project),
          poolName: "USDC",
          apyDisplay: `${apy.toFixed(2)}%`,
          apy,
          tvlUsd: p.tvlUsd != null ? Number(p.tvlUsd) : null,
          executable: false,
          notes: "Listed for compare - one-click park uses Aave V3 on Monad.",
          chainId: MONAD_MAINNET_ID,
          asset: PARK_USDC,
        } satisfies ParkItem;
      });
    return rows;
  } catch {
    return [];
  }
}

export async function listParkVenues() {
  const llama = await fetchLlamaApy();
  const aave: ParkItem = {
    investmentId: AAVE_POOL_ID,
    protocolName: "Aave V3",
    protocolLogo: PROTOCOL_LOGOS["aave-v3"],
    poolName: "USDC",
    apyDisplay: `${llama.apy.toFixed(2)}%`,
    apy: llama.apy,
    tvlUsd: llama.tvlUsd,
    executable: true,
    notes: "Supply Circle USDC on Monad. Earn variable supply APY. Unpark anytime.",
    chainId: MONAD_MAINNET_ID,
    asset: PARK_USDC,
    aToken: AAVE_A_USDC,
    pool: AAVE_POOL,
  };

  const extras = await fetchExtraUsdcPools();
  // Aave first (executable), then higher-APY compare rows
  const items = [aave, ...extras.filter((e) => e.investmentId !== AAVE_POOL_ID)].sort(
    (a, b) => {
      if (a.executable !== b.executable) return a.executable ? -1 : 1;
      return b.apy - a.apy;
    },
  );

  // Prefer showing Aave at top among executables even if compare APYs are higher
  const executable = items.filter((i) => i.executable);
  const compare = items.filter((i) => !i.executable);
  const ordered = [...executable, ...compare];

  return {
    ok: true as const,
    items: ordered,
    note: "Park settles on Monad. Highest one-click path is Aave V3 USDC.",
  };
}

export async function buildParkDeposit(params: {
  address: string;
  investmentId: string;
  amount: string;
}) {
  if (params.investmentId !== AAVE_POOL_ID && !params.investmentId.startsWith("aave")) {
    return {
      ok: false as const,
      error:
        "This pool is compare-only. Use Aave V3 for one-click park on Monad.",
    };
  }
  const amount = params.amount.trim();
  if (!amount || !(Number(amount) > 0)) {
    return { ok: false as const, error: "Enter a USDC amount" };
  }
  const wei = parseUnits(amount, 6);
  const wallet = params.address as Address;

  const allowance = await client.readContract({
    address: PARK_USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [wallet, AAVE_POOL],
  });

  const dataList: ParkCall[] = [];
  if (allowance < wei) {
    dataList.push({
      to: PARK_USDC,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [AAVE_POOL, maxUint256],
      }),
      callDataType: "APPROVE",
      chainId: MONAD_MAINNET_ID,
    });
  }

  dataList.push({
    to: AAVE_POOL,
    data: encodeFunctionData({
      abi: poolAbi,
      functionName: "supply",
      args: [PARK_USDC, wei, wallet, 0],
    }),
    callDataType: "DEPOSIT",
    chainId: MONAD_MAINNET_ID,
  });

  return {
    ok: true as const,
    data: {
      dataList,
      investmentId: AAVE_POOL_ID,
      protocolName: "Aave V3",
      amount: amount,
      amountWei: wei.toString(),
      aToken: AAVE_A_USDC,
      pool: AAVE_POOL,
    },
  };
}

export async function buildParkRedeem(params: {
  address: string;
  investmentId: string;
  amount?: string;
}) {
  if (params.investmentId !== AAVE_POOL_ID && !params.investmentId.startsWith("aave")) {
    return {
      ok: false as const,
      error: "Unpark is wired for Aave V3 USDC on Monad.",
    };
  }
  const wallet = params.address as Address;
  const aBal = await client.readContract({
    address: AAVE_A_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet],
  });
  if (aBal <= 0n) {
    return { ok: false as const, error: "Nothing parked in Aave USDC." };
  }

  // amount omitted or "max" → withdraw all (type(uint256).max)
  let withdrawAmt = maxUint256;
  if (params.amount && params.amount !== "max" && Number(params.amount) > 0) {
    withdrawAmt = parseUnits(params.amount, 6);
    if (withdrawAmt > aBal) withdrawAmt = aBal;
  }

  const dataList: ParkCall[] = [
    {
      to: AAVE_POOL,
      data: encodeFunctionData({
        abi: poolAbi,
        functionName: "withdraw",
        args: [PARK_USDC, withdrawAmt, wallet],
      }),
      callDataType: "WITHDRAW",
      chainId: MONAD_MAINNET_ID,
    },
  ];

  return {
    ok: true as const,
    data: {
      dataList,
      investmentId: AAVE_POOL_ID,
      protocolName: "Aave V3",
      aTokenBalance: aBal.toString(),
      aTokenBalanceHuman: formatUnits(aBal, 6),
    },
  };
}

export async function parkedUsdcBalance(wallet: string) {
  try {
    const bal = await client.readContract({
      address: AAVE_A_USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet as Address],
    });
    return { ok: true as const, balance: bal, human: formatUnits(bal, 6) };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "balance failed",
    };
  }
}
