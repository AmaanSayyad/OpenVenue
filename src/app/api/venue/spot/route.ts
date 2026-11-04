import { NextResponse } from "next/server";
import { parseUnits } from "viem";
import { buildSwap, getApproveTx, USDC_MONAD } from "@/lib/binance/trading";
import { USDC_DECIMALS } from "@/lib/monad/chains";
import { WMON } from "@/lib/monad/uniswap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Build a live Uniswap V3 MON ↔ USDC swap on Monad.
 * body: { side: "buy_usdc" | "sell_usdc", amount: human string, wallet }
 * - buy_usdc: spend `amount` MON for USDC
 * - sell_usdc: spend `amount` USDC for MON
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      side?: string;
      amount?: string;
      wallet?: string;
      slippagePercent?: string;
    };
    const wallet = body.wallet;
    const amountHuman = body.amount;
    const side = (body.side || "buy_usdc").toLowerCase();
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }
    if (!amountHuman || !(Number(amountHuman) > 0)) {
      return NextResponse.json({ error: "amount required" }, { status: 400 });
    }

    const buyUsdc = side === "buy_usdc" || side === "mon_to_usdc";
    const from = buyUsdc ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" : USDC_MONAD;
    const to = buyUsdc ? USDC_MONAD : WMON;
    const amount = buyUsdc
      ? parseUnits(amountHuman, 18).toString()
      : parseUnits(amountHuman, USDC_DECIMALS).toString();

    const approve = await getApproveTx({
      tokenContractAddress: from,
      approveAmount: amount,
      userWalletAddress: wallet,
    });
    const swap = await buildSwap({
      quoteId: `spot-${Date.now()}`,
      fromTokenAddress: from,
      toTokenAddress: to,
      amount,
      userWalletAddress: wallet,
      slippagePercent: body.slippagePercent || "1.5",
    });
    if (!swap.ok) {
      return NextResponse.json(
        { ok: false, error: ("error" in swap && swap.error) || "build failed" },
        { status: 400 },
      );
    }

    const nativePay = buyUsdc;
    return NextResponse.json({
      ok: true,
      side: buyUsdc ? "buy_usdc" : "sell_usdc",
      from,
      to,
      amount,
      amountHuman,
      approve:
        approve.ok && approve.data && !nativePay
          ? {
              to: approve.data.to || from,
              data: approve.data.data,
            }
          : null,
      allowancePending: !nativePay && Boolean(approve.allowancePending),
      swap: swap.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Spot build failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
