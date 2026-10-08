import { NextResponse } from "next/server";
import {
  corporateActionLabel,
  fetchAssetMarketStatus,
} from "@/lib/binance/assetStatus";
import { searchRwaByTicker } from "@/lib/binance/rwa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get("ticker") || "").trim();
    let contract = searchParams.get("contract") || undefined;

    if (!contract && ticker) {
      const cands = await searchRwaByTicker(ticker);
      const preferred =
        cands.find((c) => c.kind === "ondo") ||
        cands.find((c) => c.kind === "bstock") ||
        cands[0];
      contract = preferred?.contractAddress;
    }

    if (!contract) {
      return NextResponse.json(
        { ok: false, error: "contract or ticker required" },
        { status: 400 },
      );
    }

    const status = await fetchAssetMarketStatus(contract);
    if (!status) {
      return NextResponse.json({ ok: true, status: null, action: null });
    }

    const limited =
      status.reasonCode === "ASSET_PAUSED" ||
      status.reasonCode === "ASSET_LIMITED" ||
      status.reasonCode === "MARKET_PAUSED";

    return NextResponse.json({
      ok: true,
      contract,
      status,
      action: limited
        ? {
            code: status.reasonCode,
            label: corporateActionLabel(status.reasonMsg) || status.reasonCode,
            message: status.reasonMsg,
            openState: status.openState,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
