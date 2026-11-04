/**
 * PancakeSwap V2 swap builder on BNB Chain for tokenized stock venues.
 */
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  maxUint256,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { bsc } from "viem/chains";
import { USDT_BSC, WBNB_BSC } from "@/lib/venue/issuers";

export const PANCAKE_ROUTER_V2 =
  "0x10ED43C718714eb63d5aA57B78B54704E256024E" as const;

const routerAbi = parseAbi([
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)",
]);

const client = createPublicClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org"),
});

async function pickPath(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
): Promise<Address[] | null> {
  type Cand = { path: Address[]; out: bigint };
  const cands: Cand[] = [];

  const tryPath = async (path: Address[]) => {
    try {
      const amounts = await client.readContract({
        address: PANCAKE_ROUTER_V2,
        abi: routerAbi,
        functionName: "getAmountsOut",
        args: [amountIn, path],
      });
      const out = amounts[amounts.length - 1];
      if (out > 0n) cands.push({ path, out });
    } catch {
      /* skip */
    }
  };

  await tryPath([tokenIn, tokenOut]);
  if (
    tokenIn.toLowerCase() !== WBNB_BSC.toLowerCase() &&
    tokenOut.toLowerCase() !== WBNB_BSC.toLowerCase()
  ) {
    await tryPath([tokenIn, WBNB_BSC, tokenOut]);
  }

  if (!cands.length) return null;
  cands.sort((a, b) => (a.out > b.out ? -1 : a.out < b.out ? 1 : 0));
  return cands[0].path;
}

export async function quotePancake(params: {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
}) {
  const path = await pickPath(params.tokenIn, params.tokenOut, params.amountIn);
  if (!path) return { ok: false as const, error: "No PancakeSwap path on BSC" };
  const amounts = await client.readContract({
    address: PANCAKE_ROUTER_V2,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: [params.amountIn, path],
  });
  return {
    ok: true as const,
    path,
    amountOut: amounts[amounts.length - 1],
    amounts,
  };
}

export async function buildPancakeSwap(params: {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  userWalletAddress: string;
  slippagePercent?: string;
}) {
  const amountIn = BigInt(params.amount);
  if (amountIn <= 0n) {
    return { ok: false as const, error: "Invalid amount" };
  }
  const tokenIn = params.fromTokenAddress as Address;
  const tokenOut = params.toTokenAddress as Address;
  const quoted = await quotePancake({ tokenIn, tokenOut, amountIn });
  if (!quoted.ok) return quoted;

  const slip = Math.max(0.1, Number(params.slippagePercent || "1.5"));
  const minOut =
    (quoted.amountOut * BigInt(Math.floor((100 - slip) * 100))) / 10000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const data = encodeFunctionData({
    abi: routerAbi,
    functionName: "swapExactTokensForTokens",
    args: [
      amountIn,
      minOut,
      quoted.path,
      params.userWalletAddress as Address,
      deadline,
    ],
  });

  return {
    ok: true as const,
    data: {
      quoteId: `pancake-${Date.now()}`,
      chainId: 56,
      fromTokenAddress: params.fromTokenAddress,
      toTokenAddress: params.toTokenAddress,
      amount: params.amount,
      userWalletAddress: params.userWalletAddress,
      amountOut: quoted.amountOut.toString(),
      path: quoted.path,
      tx: {
        to: PANCAKE_ROUTER_V2,
        data,
        value: "0",
        chainId: 56,
      },
    },
  };
}

export async function buildPancakeApprove(params: {
  tokenContractAddress: string;
  amount?: string;
}) {
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [PANCAKE_ROUTER_V2, params.amount ? BigInt(params.amount) : maxUint256],
  });
  return {
    ok: true as const,
    data: {
      to: params.tokenContractAddress,
      data,
      gasLimit: "80000",
      dexContractAddress: PANCAKE_ROUTER_V2,
    },
  };
}

export async function needsPancakeAllowance(params: {
  token: string;
  owner: string;
  amount: bigint;
}) {
  try {
    const current = await client.readContract({
      address: params.token as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [params.owner as Address, PANCAKE_ROUTER_V2],
    });
    return current < params.amount;
  } catch {
    return true;
  }
}

export function isBscUsdt(addr: string) {
  return addr.toLowerCase() === USDT_BSC.toLowerCase();
}

export { client as bscClient };
