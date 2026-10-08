import { NextResponse } from "next/server";
import {
  fetchGasSnapshot,
  getAllowance,
  getNativeAndUsdt,
} from "@/lib/binance/wallet";
import { USDT_BSC } from "@/lib/venue/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SPENDER = "0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const spender = searchParams.get("spender") || DEFAULT_SPENDER;
    const token = searchParams.get("token") || USDT_BSC;

    const gas = await fetchGasSnapshot();
    if (!wallet) {
      return NextResponse.json({ ok: true, gas, balances: null, allowance: null });
    }

    const balances = await getNativeAndUsdt(wallet);
    const allowanceWei = await getAllowance(wallet, token, spender);
    const gasUsdEstimate =
      gas.medium && balances
        ? (Number(gas.medium) * 350_000) / 1e18 * 600 // rough BNB@$600, 350k gas
        : null;

    return NextResponse.json({
      ok: true,
      gas,
      balances,
      allowance: {
        token,
        spender,
        wei: allowanceWei.toString(),
        human: (Number(allowanceWei) / 1e18).toString(),
      },
      roughSwapGasUsd: gasUsdEstimate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Wallet status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
