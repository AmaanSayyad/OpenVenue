import { NextResponse } from "next/server";
import {
  buildSwap,
  getApproveTx,
  USDT_BSC,
} from "@/lib/binance/trading";
import { simulateEvmTx } from "@/lib/binance/transaction";

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

    const approve = await getApproveTx({
      tokenContractAddress: from,
      approveAmount: body.amount,
      vendor: mode === "RFQ" ? body.vendor : undefined,
    });

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
    const allowancePending =
      !simOk && /allowance/i.test(failReason) && approve.ok;

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
