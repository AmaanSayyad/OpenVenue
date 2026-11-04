import { USDC_DECIMALS, usdcForChain, defaultChainId } from "@/lib/monad/chains";

/** Circle USDC on Monad uses 6 decimals. */
export function usdtAmountToWei(amountUsdt: number | string): bigint {
  const n = typeof amountUsdt === "string" ? Number(amountUsdt) : amountUsdt;
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid USDC amount");
  const [whole, frac = ""] = n.toFixed(USDC_DECIMALS).split(".");
  const padded = (frac + "000000").slice(0, USDC_DECIMALS);
  return BigInt(whole) * BigInt(10 ** USDC_DECIMALS) + BigInt(padded || "0");
}

export function toHumanAmount(amount: string, decimals = 18) {
  try {
    const bi = BigInt(amount);
    const base = BigInt("1" + "0".repeat(decimals));
    const whole = bi / base;
    const frac = (bi % base)
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
    return frac ? `${whole}.${frac.slice(0, 6)}` : whole.toString();
  } catch {
    return amount;
  }
}

/** Active Monad USDC (legacy export name kept for desk imports) */
export const USDT_BSC = usdcForChain(defaultChainId());
