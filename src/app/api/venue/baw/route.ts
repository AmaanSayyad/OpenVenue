import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { bsc } from "viem/chains";
import { listUsdtEarnInvestments } from "@/lib/binance/defi";
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
    if (missing && (op === "gas" || op === "status" || op === "defi")) {
      const fallback = await deskFallback(op);
      if (fallback) {
        return NextResponse.json({
          ok: true,
          module: "agentic-wallet",
          missingCli: true,
          via: "desk",
          ...fallback,
        });
      }
    }
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

async function deskFallback(op: "gas" | "status" | "defi") {
  if (op === "defi") {
    const list = await listUsdtEarnInvestments();
    if (!list.ok || list.items.length === 0) return null;
    return {
      exitCode: 0,
      json: { count: list.items.length, names: list.items.slice(0, 5).map((i) => i.protocolName) },
      stdout: "",
      stderr: "",
      called: true,
    };
  }
  const client = createPublicClient({
    chain: bsc,
    transport: http("https://bsc-dataseed.binance.org"),
  });
  if (op === "status") {
    const chainId = await client.getChainId();
    return {
      exitCode: 0,
      json: { chainId },
      stdout: "",
      stderr: "",
      called: true,
    };
  }
  const gasPrice = await client.getGasPrice();
  return {
    exitCode: 0,
    json: { gasPrice: gasPrice.toString() },
    stdout: "",
    stderr: "",
    called: true,
  };
}
