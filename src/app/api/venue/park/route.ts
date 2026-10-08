import { NextResponse } from "next/server";
import {
  buildDeposit,
  buildRedeem,
  listUsdtEarnInvestments,
} from "@/lib/binance/defi";
import { USDT_BSC } from "@/lib/binance/trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await listUsdtEarnInvestments();
    return NextResponse.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : "DeFi list failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      address: string;
      investmentId: string;
      amount?: string;
      action?: "deposit" | "redeem";
      ratio?: string;
    };
    if (!body.address || !body.investmentId) {
      return NextResponse.json(
        { error: "address and investmentId required" },
        { status: 400 },
      );
    }

    const action = body.action || "deposit";
    if (action === "redeem") {
      const built = await buildRedeem({
        address: body.address,
        investmentId: body.investmentId,
        tokenAddress: USDT_BSC,
        amount: body.amount,
        ratio: body.ratio || "1",
        simulate: true,
      });
      if (!built.ok) {
        return NextResponse.json({ ok: false, error: built.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, action, data: built.data });
    }

    if (!body.amount) {
      return NextResponse.json({ error: "amount required for deposit" }, { status: 400 });
    }

    const built = await buildDeposit({
      address: body.address,
      investmentId: body.investmentId,
      tokenAddress: USDT_BSC,
      amount: body.amount,
      simulate: true,
    });

    if (!built.ok) {
      return NextResponse.json({ ok: false, error: built.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, action, data: built.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deposit build failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
