import { NextResponse } from "next/server";
import { runCli } from "@/lib/rails/cli";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const version = await runCli("bag", ["--version"], 8_000);
  const base = process.env.VENUE_TAPE_URL || "http://127.0.0.1:9000";
  let ping: { ok: boolean; status?: number; body?: string; error?: string } = {
    ok: false,
  };
  try {
    const res = await fetch(`${base}/ping`, { signal: AbortSignal.timeout(2500) });
    ping = {
      ok: res.ok,
      status: res.status,
      body: (await res.text()).slice(0, 400),
    };
  } catch (err) {
    ping = {
      ok: false,
      error: err instanceof Error ? err.message : "agent unreachable",
    };
  }

  return NextResponse.json({
    ok: version.code === 0 || ping.ok,
    module: "bnb-agent-studio",
    bag: {
      called: version.code !== null,
      exitCode: version.code,
      version: version.stdout.trim().slice(0, 200),
      error: version.stderr.slice(0, 400),
    },
    agent: { url: base, ...ping },
    seller: {
      priceUsd: "0.05",
      rails: ["erc-8183", "x402", "b402"],
      workspace: "venuetape",
    },
  });
}
