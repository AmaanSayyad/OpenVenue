import { NextResponse } from "next/server";
import { isOcSuccess, ocPost, ocGet } from "@/lib/binance/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Submit a signed RFQ order (equity / RWA). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      requestId: string;
      quoteId: string;
      vendor: string;
      userSignature: string;
      signingScheme?: string;
    };

    if (!body.requestId || !body.quoteId || !body.vendor || !body.userSignature) {
      return NextResponse.json(
        { error: "requestId, quoteId, vendor, userSignature required" },
        { status: 400 },
      );
    }

    const result = await ocPost<Record<string, unknown>>(
      "/api/v1/dex/aggregator/order/submit",
      {
        requestId: body.requestId,
        quoteId: body.quoteId,
        vendor: body.vendor,
        userSignature: body.userSignature,
        signingScheme: body.signingScheme,
      },
    );

    if (!isOcSuccess(result)) {
      return NextResponse.json(
        { ok: false, error: `${result.code}: ${result.msg}`, data: result.data },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "RFQ submit failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }
  const result = await ocGet(`/api/v1/dex/aggregator/order/${orderId}`, {});
  return NextResponse.json(result);
}
