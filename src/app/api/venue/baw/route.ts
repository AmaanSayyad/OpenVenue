import { NextResponse } from "next/server";
import { callBaw, type BawOp } from "@/lib/rails/baw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPS = new Set<BawOp>(["status", "gas", "quote", "defi", "x402-preview"]);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      op?: string;
      fromTokenQty?: string;
      toToken?: string;
      paymentRequirements?: string;
    };
    const op = body.op as BawOp;
    if (!OPS.has(op)) {
      return NextResponse.json({ ok: false, error: "unknown op" }, { status: 400 });
    }
    const result = await callBaw(op, {
      fromTokenQty: body.fromTokenQty || "",
      toToken: body.toToken || "",
      paymentRequirements: body.paymentRequirements || "",
    });
    const missing = result.stderr.includes("ENOENT") || result.exitCode === null;
    return NextResponse.json({
      ok: result.exitCode === 0,
      module: "agentic-wallet",
      missingCli: missing,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "baw failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
