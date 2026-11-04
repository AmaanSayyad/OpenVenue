import { NextResponse } from "next/server";
import {
  fetchGasSnapshot,
  fetchMonUsdPrice,
  getAllowance,
  getNativeAndUsdt,
} from "@/lib/binance/wallet";
import { defaultChainId, MONAD_MAINNET_ID, usdcForChain } from "@/lib/monad/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SPENDER = "0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const chainRaw = searchParams.get("chainId");
    const chainId =
      chainRaw === "143"
        ? MONAD_MAINNET_ID
        : chainRaw === "10143"
          ? 10143
          : defaultChainId();
    const spender = searchParams.get("spender") || DEFAULT_SPENDER;
    const token = searchParams.get("token") || usdcForChain(chainId);

    const gas = await fetchGasSnapshot(chainId);
    if (!wallet) {
      return NextResponse.json({ ok: true, gas, balances: null, allowance: null });
    }

    const [balances, monUsd] = await Promise.all([
      getNativeAndUsdt(wallet, chainId),
      fetchMonUsdPrice(),
    ]);
    const allowanceWei = await getAllowance(wallet, token, spender, chainId);
    const gasUsdEstimate =
      gas.medium && balances
        ? (Number(gas.medium) * 350_000) / 1e18 * monUsd
        : null;

    return NextResponse.json({
      ok: true,
      gas,
      balances,
      allowance: {
        token,
        spender,
        wei: allowanceWei.toString(),
        human: (Number(allowanceWei) / 1e6).toString(),
      },
      roughSwapGasUsd: gasUsdEstimate,
      chainId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Wallet status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
