import { NextResponse } from "next/server";
import {
  buildParkDeposit,
  buildParkRedeem,
  listParkVenues,
} from "@/lib/monad/park";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await listParkVenues();
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
      const built = await buildParkRedeem({
        address: body.address,
        investmentId: body.investmentId,
        amount: body.amount
          ? body.amount
          : body.ratio === "1"
            ? "max"
            : undefined,
      });
      if (!built.ok) {
        return NextResponse.json({ ok: false, error: built.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, action, data: built.data });
    }

    if (!body.amount) {
      return NextResponse.json({ error: "amount required for deposit" }, { status: 400 });
    }

    const built = await buildParkDeposit({
      address: body.address,
      investmentId: body.investmentId,
      amount: body.amount,
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
