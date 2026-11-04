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
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)",
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
      // Ignore dust quotes that round to ~0 for users
      if (out > 1000n) cands.push({ path, out });
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

function involvesUsdt(path: Address[]) {
  const u = USDT_BSC.toLowerCase();
  return path.some((p) => p.toLowerCase() === u);
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

  // Multi-hop (via WBNB) moves more between quote and inclusion — floor at 3%.
  const userSlip = Math.max(0.1, Number(params.slippagePercent || "1.5"));
  const multiHop = quoted.path.length > 2;
  const slip = multiHop ? Math.max(userSlip, 3) : userSlip;
  const bps = BigInt(Math.floor((100 - slip) * 100));
  const minOut = (quoted.amountOut * bps) / 10000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const to = params.userWalletAddress as Address;

  // BSC-USD / fee-on-transfer tokens need the supporting router entrypoint.
  const useFeeOnTransfer = involvesUsdt(quoted.path);
  const data = encodeFunctionData({
    abi: routerAbi,
    functionName: useFeeOnTransfer
      ? "swapExactTokensForTokensSupportingFeeOnTransferTokens"
      : "swapExactTokensForTokens",
    args: [amountIn, minOut, quoted.path, to, deadline],
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
      amountOutMin: minOut.toString(),
      path: quoted.path,
      slippageApplied: slip,
      tx: {
        to: PANCAKE_ROUTER_V2,
        data,
        value: "0",
        chainId: 56,
      },
    },
  };
}

/** eth_call the built swap so we fail before MetaMask when possible. */
export async function simulatePancakeTx(params: {
  from: Address;
  to: Address;
  data: Hex;
  value?: bigint;
}) {
  try {
    await client.call({
      account: params.from,
      to: params.to,
      data: params.data,
      value: params.value,
    });
    return { ok: true as const };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    let reason = "Swap would revert on BNB Chain";
    if (/TRANSFER_FROM_FAILED/i.test(raw)) {
      reason =
        "BNB Chain USDT transfer failed — check USDT balance on BSC (not Monad USDC) and Pancake allowance.";
    } else if (/INSUFFICIENT_OUTPUT|excessive|K\b|EXPIRED/i.test(raw)) {
      reason =
        "Price moved past slippage on this thin pool. Raise slippage to 3–5% and refresh the quote.";
    } else if (/insufficient funds|gas/i.test(raw)) {
      reason = "Not enough BNB for gas on BNB Chain.";
    }
    return { ok: false as const, error: reason, raw };
  }
}

export async function readBscUsdtBalance(owner: Address) {
  return client.readContract({
    address: USDT_BSC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
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
