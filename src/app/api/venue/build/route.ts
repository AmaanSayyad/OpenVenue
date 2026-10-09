import { NextResponse } from "next/server";
import { createPublicClient, decodeFunctionData, erc20Abi, http, type Address } from "viem";
import { bsc } from "viem/chains";
import {
  buildSwap,
  getApproveTx,
  USDT_BSC,
} from "@/lib/binance/trading";
import { simulateEvmTx } from "@/lib/binance/transaction";

const bscClient = createPublicClient({
  chain: bsc,
  transport: http("https://bsc-dataseed.binance.org"),
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
  simulate?: boolean;
  /** If true (default), fail the request when simulation is unsuccessful */
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

    const from = body.fromTokenAddress || USDT_BSC;
    const mode = (body.executionMode || "SWAP").toUpperCase();

    let approve = await getApproveTx({
      tokenContractAddress: from,
      approveAmount: body.amount,
      vendor: body.vendor,
    });
    if (!approve.ok && body.vendor) {
      approve = await getApproveTx({
        tokenContractAddress: from,
        approveAmount: body.amount,
      });
    }

    const swap = await buildSwap({
      quoteId: body.quoteId,
      fromTokenAddress: from,
      toTokenAddress: body.toTokenAddress,
      amount: body.amount,
      userWalletAddress: body.userWalletAddress,
      slippagePercent: body.slippagePercent ?? "1",
      vendor: body.vendor,
    });

    if (!swap.ok) {
      return NextResponse.json({ ok: false, error: swap.error }, { status: 400 });
    }

    let simulation = null;
    const tx = (swap.data as { tx?: Record<string, string> })?.tx;
    if (body.simulate !== false && tx?.to && tx?.data) {
      simulation = await simulateEvmTx({
        from: body.userWalletAddress,
        to: tx.to,
        data: tx.data,
        value: tx.value || "0",
        gas: tx.gas,
        gasPrice: tx.gasPrice,
      });
    }

    const failReason = simulation
      ? simulation.ok
        ? (simulation.data as { failReason?: string })?.failReason || ""
        : simulation.error || ""
      : "";
    const simOk =
      !simulation ||
      (simulation.ok &&
        (simulation.data as { status?: string })?.status !== "FAIL" &&
        (simulation.data as { status?: string })?.status !== "FAILED");
    // The swap is simulated before the approve is mined. A missing allowance
    // is expected; the client signs the approve, then the swap.
    let allowancePending =
      !simOk && /allowance/i.test(failReason) && approve.ok;
    if (!simOk && approve.ok && approve.data?.data && !allowancePending) {
      allowancePending = await allowanceIsShort({
        token: from,
        owner: body.userWalletAddress,
        amount: body.amount,
        approveData: approve.data.data,
        spenderHint: approve.data.dexContractAddress,
      });
    }

    if (body.requireSimOk !== false && simulation && !simOk && !allowancePending) {
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
      executionMode: mode,
      approve: approve.ok ? approve.data : null,
      approveError: approve.ok ? null : approve.error,
      swap: swap.data,
      simulation,
      simOk: simOk || allowancePending,
      allowancePending,
      fromTokenAddress: from,
      slippagePercent: body.slippagePercent ?? "1",
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
}) {
  try {
    let spender = params.spenderHint;
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: params.approveData as `0x${string}`,
    });
    if (decoded.functionName === "approve") {
      spender = decoded.args[0];
    }
    if (!spender) return false;
    const current = await bscClient.readContract({
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
