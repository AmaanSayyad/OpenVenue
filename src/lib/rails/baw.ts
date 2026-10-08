import { USDT_BSC } from "@/lib/venue/types";
import { parseJson, runCli } from "./cli";

export type BawOp = "status" | "gas" | "quote" | "defi" | "x402-preview";

const USDT = USDT_BSC;

function okShape(bin: string, code: number | null, stdout: string, stderr: string) {
  return {
    bin,
    exitCode: code,
    json: parseJson(stdout),
    stdout: stdout.slice(0, 4000),
    stderr: stderr.slice(0, 1500),
    called: code !== null,
  };
}

export async function callBaw(op: BawOp, input: Record<string, string>) {
  if (op === "status") {
    const r = await runCli("baw", ["wallet", "status", "--json"]);
    return okShape("baw wallet status", r.code, r.stdout, r.stderr);
  }
  if (op === "gas") {
    const r = await runCli("baw", [
      "wallet",
      "gas-price",
      "--binanceChainId",
      "56",
      "--json",
    ]);
    return okShape("baw wallet gas-price", r.code, r.stdout, r.stderr);
  }
  if (op === "defi") {
    const r = await runCli("baw", [
      "defi",
      "investment-list",
      "--investType",
      "Earn",
      "--binanceChainId",
      "56",
      "--page",
      "1",
      "--size",
      "5",
      "--json",
    ]);
    return okShape("baw defi investment-list", r.code, r.stdout, r.stderr);
  }
  if (op === "quote") {
    const qty = input.fromTokenQty || "15";
    const to = input.toToken;
    if (!/^0x[a-fA-F0-9]{40}$/.test(to || "")) {
      throw new Error("toToken must be a contract address");
    }
    if (!/^\d+(\.\d+)?$/.test(qty)) throw new Error("invalid qty");
    const r = await runCli("baw", [
      "market-order",
      "quote",
      "--fromTokenQty",
      qty,
      "--fromToken",
      USDT,
      "--toToken",
      to,
      "--binanceChainId",
      "56",
      "--json",
    ]);
    return okShape("baw market-order quote", r.code, r.stdout, r.stderr);
  }
  const raw = input.paymentRequirements;
  if (!raw || raw.length > 20_000) throw new Error("paymentRequirements required");
  const r = await runCli("baw", [
    "x402-payment",
    "preview",
    "--paymentRequirements",
    raw,
    "--json",
  ]);
  return okShape("baw x402-payment preview", r.code, r.stdout, r.stderr);
}
