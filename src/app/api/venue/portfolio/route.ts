import { NextResponse } from "next/server";
import {
  allTrackedWrappers,
  buildPortfolio,
} from "@/lib/binance/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "valid wallet required" }, { status: 400 });
    }

    const extra = (searchParams.get("tokens") || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^0x[a-f0-9]{40}$/.test(s));

    const discovered = allTrackedWrappers();
    const seen = new Set(
      discovered.map((d) => `${d.chainId}:${d.address.toLowerCase()}`),
    );

    for (const addr of extra) {
      const key = `143:${addr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      discovered.push({
        address: addr,
        symbol: "TOKEN",
        ticker: "?",
        kind: "bstock",
        platform: "unknown",
        chainId: 143,
      });
    }

    const portfolio = await buildPortfolio({
      wallet,
      contracts: discovered,
    });
    return NextResponse.json({ ok: true, portfolio });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portfolio failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
