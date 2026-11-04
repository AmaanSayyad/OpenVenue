import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  maxUint256,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import {
  defaultChainId,
  monadMainnet,
  monadTestnet,
  MONAD_MAINNET_ID,
  USDC_DECIMALS,
  usdcForChain,
} from "@/lib/monad/chains";

/** Uniswap V3 on Monad mainnet (official deployments). */
export const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as const;
export const SWAP_ROUTER_02 =
  "0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900" as const;
export const QUOTER_V2 = "0x661e93cca42afacb172121ef892830ca3b70f08d" as const;

const FEE_TIERS = [500, 3000, 100, 10000] as const;

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const routerAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[])",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) payable",
  "function refundETH() payable",
]);

const approveAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

function client() {
  const chain =
    defaultChainId() === MONAD_MAINNET_ID ? monadMainnet : monadTestnet;
  return createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0], { timeout: 20_000 }),
  });
}

export function isNativeOrWmon(addr: string) {
  const a = addr.toLowerCase();
  return (
    a === WMON.toLowerCase() ||
    a === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
    a === "0x0000000000000000000000000000000000000000"
  );
}

export function normalizeToken(addr: string): Address {
  return (isNativeOrWmon(addr) ? WMON : addr) as Address;
}

export function isUsdc(addr: string) {
  try {
    return addr.toLowerCase() === usdcForChain(defaultChainId()).toLowerCase();
  } catch {
    return false;
  }
}

/** True when both sides are the liquid MON/USDC pair we can execute on Uniswap. */
export function isLiquidMonadPair(from: string, to: string) {
  const a = normalizeToken(from).toLowerCase();
  const b = normalizeToken(to).toLowerCase();
  const usdc = usdcForChain(defaultChainId()).toLowerCase();
  const wmon = WMON.toLowerCase();
  return (
    (a === usdc && b === wmon) ||
    (a === wmon && b === usdc)
  );
}

export async function quoteExactIn(params: {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
}): Promise<{ fee: number; amountOut: bigint } | null> {
  const publicClient = client();
  let best: { fee: number; amountOut: bigint } | null = null;
  for (const fee of FEE_TIERS) {
    try {
      const { result } = await publicClient.simulateContract({
        address: QUOTER_V2,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      const amountOut = result[0] as bigint;
      if (!best || amountOut > best.amountOut) best = { fee, amountOut };
    } catch {
      /* no pool / revert */
    }
  }
  return best;
}

export async function buildUniswapSwap(params: {
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string; // wei string
  userWalletAddress: string;
  slippagePercent?: string;
}) {
  const amountIn = BigInt(params.amount);
  if (amountIn <= 0n) {
    return { ok: false as const, error: "Amount must be > 0" };
  }

  const tokenIn = normalizeToken(params.fromTokenAddress);
  const tokenOut = normalizeToken(params.toTokenAddress);
  const recipient = params.userWalletAddress as Address;
  const nativeIn = isNativeOrWmon(params.fromTokenAddress);
  const nativeOut = isNativeOrWmon(params.toTokenAddress);
  // Only treat as native value when the original from was native/zero/eeee (not already WMON ERC20)
  const payNative =
    params.fromTokenAddress.toLowerCase() !== WMON.toLowerCase() &&
    isNativeOrWmon(params.fromTokenAddress);

  if (!isLiquidMonadPair(params.fromTokenAddress, params.toTokenAddress)) {
    return {
      ok: false as const,
      error:
        "No live Uniswap route for this pair on Monad yet. Stock wrappers need issuer contracts; liquid desk supports MON ↔ USDC.",
    };
  }

  const quote = await quoteExactIn({ tokenIn, tokenOut, amountIn });
  if (!quote) {
    return { ok: false as const, error: "No WMON/USDC Uniswap pool quote" };
  }

  const slipBps = Math.max(
    1,
    Math.round(Number(params.slippagePercent || "1.5") * 100),
  );
  const amountOutMinimum =
    (quote.amountOut * BigInt(10_000 - slipBps)) / 10_000n;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  const swapData = encodeFunctionData({
    abi: routerAbi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        fee: quote.fee,
        recipient: nativeOut && !payNative ? SWAP_ROUTER_02 : recipient,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  let data: Hex = swapData;
  let value = payNative ? amountIn : 0n;

  if (nativeOut) {
    // Receive WMON on router then unwrap to MON
    const unwrap = encodeFunctionData({
      abi: routerAbi,
      functionName: "unwrapWETH9",
      args: [amountOutMinimum, recipient],
    });
    data = encodeFunctionData({
      abi: routerAbi,
      functionName: "multicall",
      args: [deadline, [swapData, unwrap]],
    });
  }

  const outDecimals = isUsdc(tokenOut) ? USDC_DECIMALS : 18;
  const inDecimals = isUsdc(tokenIn) ? USDC_DECIMALS : 18;

  return {
    ok: true as const,
    data: {
      quoteId: `uni-v3-${quote.fee}-${Date.now()}`,
      chainId: defaultChainId(),
      vendorName: "Uniswap V3",
      fee: quote.fee,
      amountOut: quote.amountOut.toString(),
      amountOutHuman: formatUnits(quote.amountOut, outDecimals),
      amountInHuman: formatUnits(amountIn, inDecimals),
      tx: {
        to: SWAP_ROUTER_02,
        data,
        value: value.toString(),
      },
      to: SWAP_ROUTER_02,
      data,
      value: value.toString(),
    },
  };
}

export async function buildUniswapApprove(params: {
  tokenContractAddress: string;
  amount?: string;
}) {
  const token = params.tokenContractAddress as Address;
  // Native MON needs no approve (value path)
  if (
    isNativeOrWmon(token) &&
    token.toLowerCase() !== WMON.toLowerCase()
  ) {
    return {
      ok: true as const,
      data: null,
      skip: true as const,
    };
  }
  const amount = params.amount ? BigInt(params.amount) : maxUint256;
  const data = encodeFunctionData({
    abi: approveAbi,
    functionName: "approve",
    args: [SWAP_ROUTER_02, amount > 0n ? amount : maxUint256],
  });
  return {
    ok: true as const,
    skip: false as const,
    data: {
      to: token,
      data,
      dexContractAddress: SWAP_ROUTER_02,
      gasLimit: "80000",
    },
  };
}

export async function needsAllowance(params: {
  token: string;
  owner: string;
  amount: bigint;
}) {
  if (isNativeOrWmon(params.token) && params.token.toLowerCase() !== WMON.toLowerCase()) {
    return false;
  }
  const publicClient = client();
  const allowance = await publicClient.readContract({
    address: normalizeToken(params.token),
    abi: erc20Abi,
    functionName: "allowance",
    args: [params.owner as Address, SWAP_ROUTER_02],
  });
  return allowance < params.amount;
}
