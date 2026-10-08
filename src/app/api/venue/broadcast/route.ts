import { NextResponse } from "next/server";
import { broadcastSignedTx, getTxDetail } from "@/lib/binance/transaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      address: string;
      signedTransaction: string;
      enableMevProtection?: boolean;
    };

    if (!body.address || !body.signedTransaction) {
      return NextResponse.json(
        { error: "address and signedTransaction required" },
        { status: 400 },
      );
    }

    const result = await broadcastSignedTx({
      address: body.address,
      signedTransaction: body.signedTransaction,
      enableMevProtection: body.enableMevProtection ?? true,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Broadcast failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const txHash = new URL(req.url).searchParams.get("txHash");
  if (!txHash) {
    return NextResponse.json({ error: "txHash required" }, { status: 400 });
  }
  const detail = await getTxDetail(txHash);
  return NextResponse.json(detail);
}
