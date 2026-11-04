import { NextResponse } from "next/server";
import {
  buildPortfolio,
  TRACKED_WRAPPERS,
} from "@/lib/binance/wallet";
import { defaultChainId, MONAD_MAINNET_ID, MONAD_TESTNET_ID } from "@/lib/monad/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseChainId(raw: string | null): number {
  if (raw === "143" || raw === String(MONAD_MAINNET_ID)) return MONAD_MAINNET_ID;
  if (raw === "10143" || raw === String(MONAD_TESTNET_ID)) return MONAD_TESTNET_ID;
  return defaultChainId();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "valid wallet required" }, { status: 400 });
    }

    const chainId = parseChainId(searchParams.get("chainId"));

    const extra = (searchParams.get("tokens") || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^0x[a-f0-9]{40}$/.test(s));

    // Only scan known/extra ERC-20s - venue registry still uses demo
    // addresses until issuers publish live Monad contracts.
    const discovered = [...TRACKED_WRAPPERS];
    const seen = new Set(discovered.map((d) => d.address.toLowerCase()));

    for (const addr of extra) {
      if (seen.has(addr)) continue;
      seen.add(addr);
      discovered.push({
        address: addr,
        symbol: "TOKEN",
        ticker: "?",
        kind: "bstock",
        platform: "unknown",
      });
    }

    const portfolio = await buildPortfolio({
      wallet,
      contracts: discovered,
      chainId,
    });
    return NextResponse.json({ ok: true, portfolio });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portfolio failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
