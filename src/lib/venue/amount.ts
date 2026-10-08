/** BSC USDT uses 18 decimals. */
export function usdtAmountToWei(amountUsdt: number | string): bigint {
  const n = typeof amountUsdt === "string" ? Number(amountUsdt) : amountUsdt;
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid USDT amount");
  const [whole, frac = ""] = n.toFixed(6).split(".");
  const padded = (frac + "000000000000000000").slice(0, 18);
  return BigInt(whole) * BigInt("1000000000000000000") + BigInt(padded);
}

export function toHumanAmount(amount: string, decimals = 18) {
  try {
    const bi = BigInt(amount);
    const base = BigInt("1" + "0".repeat(decimals));
    const whole = bi / base;
    const frac = (bi % base).toString().padStart(decimals, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac.slice(0, 6)}` : whole.toString();
  } catch {
    return amount;
  }
}

export const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
