import { NextResponse } from "next/server";
import {
  createPublicClient,
  decodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  type Address,
} from "viem";
import { bsc } from "viem/chains";
import {
  buildSwap,
  getApproveTx,
  USDT_BSC,
} from "@/lib/binance/trading";
import { simulateEvmTx } from "@/lib/binance/transaction";
import { defaultChainId, monadMainnet, monadTestnet } from "@/lib/monad/chains";
import {
  isLiquidMonadPair,
  isNativeOrWmon,
  needsAllowance,
  WMON,
} from "@/lib/monad/uniswap";
import {
  needsPancakeAllowance,
  readBscUsdtBalance,
  simulatePancakeTx,
} from "@/lib/bsc/pancake";

const homeChain = defaultChainId() === 143 ? monadMainnet : monadTestnet;
const monadClient = createPublicClient({
  chain: homeChain,
  transport: http(homeChain.rpcUrls.default.http[0]),
});
const bscClient = createPublicClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org"),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  quoteId: string;
  fromTokenAddress?: string;
  toTokenAddress: string;
  amount: string;
  userWalletAddress: string;
  slippagePercent?: string;
  vendor?: string;
  executionMode?: string;
  executionChainId?: number;
  simulate?: boolean;
  requireSimOk?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (
      !body.quoteId ||
      !body.toTokenAddress ||
      !body.amount ||
      !body.userWalletAddress
    ) {
      return NextResponse.json(
        { error: "quoteId, toTokenAddress, amount, userWalletAddress required" },
        { status: 400 },
      );
    }

    const execChain =
      body.executionChainId ||
      (body.fromTokenAddress?.toLowerCase() === USDT_BSC.toLowerCase() ||
      body.toTokenAddress.toLowerCase() === USDT_BSC.toLowerCase()
        ? 56
        : defaultChainId());

    const from =
      body.fromTokenAddress ||
      (execChain === 56 ? USDT_BSC : homeChain.id === 143
        ? "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"
        : "0x534b2f3A21130d7a60830c2Df862319e593943A3");
    const mode = (body.executionMode || "SWAP").toUpperCase();
    const liquid = isLiquidMonadPair(from, body.toTokenAddress);

    const approve = await getApproveTx({
      tokenContractAddress: from,
      approveAmount: body.amount,
      vendor: body.vendor,
      userWalletAddress: body.userWalletAddress,
      executionChainId: execChain,
    });

    const swap = await buildSwap({
      quoteId: body.quoteId,
      fromTokenAddress: from,
      toTokenAddress: body.toTokenAddress,
      amount: body.amount,
      userWalletAddress: body.userWalletAddress,
      slippagePercent: body.slippagePercent ?? "3",
      vendor: body.vendor,
      executionChainId: execChain,
    });

    if (!swap.ok) {
      return NextResponse.json(
        { ok: false, error: ("error" in swap && swap.error) || "swap build failed" },
        { status: 400 },
      );
    }

    let simulation: {
      ok: boolean;
      error?: string;
      data?: { failReason?: string; status?: string };
    } | null = null;
    const tx = (swap.data as { tx?: Record<string, string>; to?: string; data?: string })
      ?.tx;

    let allowancePending = false;
    const nativePay =
      isNativeOrWmon(from) && from.toLowerCase() !== WMON.toLowerCase();
    if (execChain === 56) {
      allowancePending = await needsPancakeAllowance({
        token: from,
        owner: body.userWalletAddress,
        amount: BigInt(body.amount),
      });
    } else if (liquid && !nativePay) {
      allowancePending = await needsAllowance({
        token: from,
        owner: body.userWalletAddress,
        amount: BigInt(body.amount),
      });
    }

    // Balance gate for BSC USDT buys — catch "0 USDT in MetaMask" before signing
    if (
      execChain === 56 &&
      from.toLowerCase() === USDT_BSC.toLowerCase()
    ) {
      try {
        const bal = await readBscUsdtBalance(body.userWalletAddress as Address);
        if (bal < BigInt(body.amount)) {
          return NextResponse.json(
            {
              ok: false,
              error: `Not enough USDT on BNB Chain. Wallet has ${formatUnits(bal, 18)} USDT; this trade needs ${formatUnits(BigInt(body.amount), 18)}. (Monad USDC cannot pay this hop.)`,
            },
            { status: 400 },
          );
        }
      } catch {
        /* RPC flake — continue; on-chain will still enforce */
      }
    }

    if (body.simulate !== false && tx?.to && tx?.data) {
      if (execChain === 56) {
        if (!allowancePending) {
          const pancakeSim = await simulatePancakeTx({
            from: body.userWalletAddress as Address,
            to: tx.to as Address,
            data: tx.data as `0x${string}`,
            value: tx.value ? BigInt(tx.value) : 0n,
          });
          simulation = pancakeSim.ok
            ? { ok: true, data: { status: "SUCCESS" } }
            : {
                ok: false,
                error: pancakeSim.error,
                data: { failReason: pancakeSim.error, status: "FAIL" },
              };
        }
      } else {
        const evmSim = await simulateEvmTx({
          from: body.userWalletAddress,
          to: tx.to,
          data: tx.data,
          value: tx.value || "0",
          gas: tx.gas,
          gasPrice: tx.gasPrice,
        });
        simulation = {
          ok: !!evmSim.ok,
          error: "error" in evmSim ? String(evmSim.error) : undefined,
          data: evmSim.ok
            ? (evmSim.data as { failReason?: string; status?: string })
            : undefined,
        };
      }
    }

    const failReason = simulation
      ? simulation.ok
        ? simulation.data?.failReason || ""
        : simulation.error || simulation.data?.failReason || ""
      : "";
    const simOk =
      !simulation ||
      (simulation.ok &&
        simulation.data?.status !== "FAIL" &&
        simulation.data?.status !== "FAILED");

    if (
      !simOk &&
      !allowancePending &&
      approve.ok &&
      approve.data &&
      "data" in approve.data &&
      approve.data.data &&
      execChain !== 56
    ) {
      allowancePending =
        /allowance/i.test(failReason) ||
        (await allowanceIsShort({
          token: from,
          owner: body.userWalletAddress,
          amount: body.amount,
          approveData: approve.data.data,
          spenderHint: approve.data.dexContractAddress,
          chainId: execChain,
        }));
    }

    if (
      body.requireSimOk !== false &&
      simulation &&
      !simOk &&
      !allowancePending
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Simulation gate blocked execute: ${failReason || "simulation unsuccessful"}`,
          simulation,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      network: execChain === 56 ? "bnb-smart-chain" : homeChain.name,
      chainId: execChain,
      executionMode: mode,
      approve:
        approve.ok && approve.data && !nativePay
          ? {
              to: approve.data.to || from,
              data: approve.data.data,
              gas: approve.data.gasLimit,
            }
          : null,
      approveError: approve.ok ? null : ("error" in approve ? approve.error : "approve failed"),
      swap: swap.data,
      simulation,
      simOk: simOk || allowancePending,
      allowancePending,
      fromTokenAddress: from,
      slippagePercent: body.slippagePercent ?? "3",
      liquid,
      feeSettlesOn: "monad",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Build failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function allowanceIsShort(params: {
  token: string;
  owner: string;
  amount: string;
  approveData: string;
  spenderHint?: string;
  chainId: number;
}) {
  try {
    let spender = params.spenderHint;
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: params.approveData as `0x${string}`,
    });
    if (decoded.functionName === "approve") {
      spender = decoded.args[0] as string;
    }
    if (!spender) return false;
    const client = params.chainId === 56 ? bscClient : monadClient;
    const current = await client.readContract({
      address: params.token as Address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [params.owner as Address, spender as Address],
    });
    return current < BigInt(params.amount);
  } catch {
    return false;
  }
}
