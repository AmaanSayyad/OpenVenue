import { isOcSuccess, ocPost } from "./client";
import { BSC_CHAIN_ID, USDT_BSC } from "../venue/types";

const USDT = USDT_BSC.toLowerCase();

/** Discover USDT earn investments on BSC (Aave / Lista / Venus / Morpho…). */
export async function listUsdtEarnInvestments() {
  const result = await ocPost<{
    list?: Array<{
      investmentId?: string;
      protocolName?: string;
      defiProtocolId?: string;
      apyDisplay?: string;
      apyBps?: number;
      investable?: boolean;
      binanceChainId?: string | number;
      assetTokenList?: Array<{ tokenAddress?: string; symbol?: string }>;
    }>;
    dataList?: Array<Record<string, unknown>>;
  }>("/api/v1/defi/data/investment/list", {
    binanceChainIds: [BSC_CHAIN_ID],
    investType: "Earn",
    page: 1,
    size: 50,
  });

  if (!isOcSuccess(result)) {
    return { ok: false as const, error: `${result.code}: ${result.msg}`, items: [] };
  }

  const protocols = await ocPost<{
    list?: Array<{
      defiProtocolId?: string;
      protocolName?: string;
      protocolLogo?: string;
    }>;
  }>("/api/v1/defi/data/protocol/list", {
    binanceChainId: BSC_CHAIN_ID,
    investType: "Earn",
    page: 1,
    size: 200,
  }).catch(() => null);

  const logoById = new Map<string, string>();
  const logoByName = new Map<string, string>();
  if (protocols && isOcSuccess(protocols)) {
    for (const p of protocols.data?.list || []) {
      const logo = p.protocolLogo || "";
      if (!logo) continue;
      if (p.defiProtocolId) logoById.set(p.defiProtocolId, logo);
      if (p.protocolName) logoByName.set(p.protocolName.toLowerCase(), logo);
    }
  }

  const raw =
    result.data?.list ||
    (result.data as { dataList?: Array<Record<string, unknown>> })?.dataList ||
    [];

  const items = (raw as Array<Record<string, unknown>>)
    .map((row) => {
      const assets = (row.assetTokenList as Array<{
        tokenAddress?: string;
        symbol?: string;
      }>) || [];
      const mentionsUsdt =
        assets.length === 0 ||
        assets.some(
          (a) =>
            (a.tokenAddress || "").toLowerCase() === USDT ||
            (a.symbol || "").toUpperCase().includes("USDT"),
        );
      const chain = String(row.binanceChainId ?? BSC_CHAIN_ID);
      const protocolId = String(row.defiProtocolId || "");
      const protocolName = String(row.protocolName || protocolId);
      const protocolLogo =
        logoById.get(protocolId) ||
        logoByName.get(protocolName.toLowerCase()) ||
        "";
      const tvlRaw = Number(row.tvl);
      return {
        investmentId: String(row.investmentId || ""),
        protocolName,
        protocolLogo,
        poolName: String(row.investmentName || ""),
        apyDisplay: String(row.apyDisplay || ""),
        tvlUsd: Number.isFinite(tvlRaw) ? tvlRaw : null,
        investable: row.investable !== false,
        mentionsUsdt,
        chainOk: chain === BSC_CHAIN_ID || chain === "56",
      };
    })
    .filter((i) => i.investmentId && i.investable && i.chainOk && i.mentionsUsdt)
    .slice(0, 12);

  return { ok: true as const, items };
}

export async function buildDeposit(params: {
  address: string;
  investmentId: string;
  tokenAddress: string;
  amount: string;
  simulate?: boolean;
}) {
  const result = await ocPost<Record<string, unknown>>(
    "/api/v1/defi/transaction/deposit",
    {
      address: params.address,
      investmentId: params.investmentId,
      token: {
        tokenAddress: params.tokenAddress,
        amount: params.amount,
      },
      simulate: params.simulate ?? true,
    },
  );

  if (!isOcSuccess(result)) {
    return { ok: false as const, error: `${result.code}: ${result.msg}` };
  }
  return { ok: true as const, data: result.data };
}

export async function buildRedeem(params: {
  address: string;
  investmentId: string;
  tokenAddress: string;
  amount?: string;
  ratio?: string;
  simulate?: boolean;
}) {
  const result = await ocPost<Record<string, unknown>>(
    "/api/v1/defi/transaction/redeem",
    {
      address: params.address,
      investmentId: params.investmentId,
      token: {
        tokenAddress: params.tokenAddress,
        amount: params.amount,
      },
      ratio: params.ratio,
      simulate: params.simulate ?? true,
    },
  );

  if (!isOcSuccess(result)) {
    return { ok: false as const, error: `${result.code}: ${result.msg}` };
  }
  return { ok: true as const, data: result.data };
}
