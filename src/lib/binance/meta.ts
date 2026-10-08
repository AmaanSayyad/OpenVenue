/** Public RWA company / attestation metadata (no HMAC required). */

import { equityTicker } from "@/lib/venue/tickers";

const META_URL =
  "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/meta/ai";

export type RwaMeta = {
  name: string;
  symbol: string;
  ticker: string;
  icon: string | null;
  dailyAttestation: string | null;
  monthlyAttestation: string | null;
  companyName: string | null;
  description: string | null;
  ceo: string | null;
  industry: string | null;
  homepageUrl: string | null;
  riskNotes: string[];
};

function absUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://bin.bnbstatic.com${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function fetchRwaMeta(
  contractAddress: string,
  chainId = "56",
): Promise<RwaMeta | null> {
  const url = `${META_URL}?chainId=${chainId}&contractAddress=${contractAddress}`;
  const res = await fetch(url, {
    headers: {
      "Accept-Encoding": "identity",
      "User-Agent": "venue/1.0",
    },
    cache: "no-store",
  });
  const json = (await res.json()) as {
    code?: string;
    success?: boolean;
    data?: {
      name?: string;
      symbol?: string;
      ticker?: string;
      icon?: string;
      dailyAttestationReports?: string;
      monthlyAttestationReports?: string;
      companyInfo?: {
        companyName?: string;
        description?: string;
        ceo?: string;
        industry?: string;
        homepageUrl?: string;
      };
    };
  };
  if (!json.data || (json.code && json.code !== "000000" && !json.success)) {
    return null;
  }
  const d = json.data;
  const sym = (d.symbol || "").toUpperCase();
  const equity = equityTicker(sym);
  const riskNotes: string[] = [
    "Tokenized equities are not the same as broker equity - issuer, custody, and hours differ by wrapper.",
    "Spot only on BNB Smart Chain. Keep BNB for gas; do not convert your entire balance.",
  ];
  if (sym.endsWith("ON") && equity !== sym) {
    riskNotes.push(
      "Ondo wrappers are typically hours-bound (RFQ). Outside US session, quotes may fail or require a wallet.",
    );
  }
  if (sym.endsWith("B") && equity !== sym) {
    riskNotes.push(
      "bStocks support SWAP and RFQ; Off-Hours AMM may still quote when US markets are closed.",
    );
  }
  if (sym.endsWith("X") && equity !== sym) {
    riskNotes.push("xStocks lean 24/7 AMM - useful weekends, may trade at a wider premium.");
  }

  return {
    name: d.name || d.symbol || "",
    symbol: d.symbol || "",
    ticker: d.ticker || "",
    icon: absUrl(d.icon),
    dailyAttestation: absUrl(d.dailyAttestationReports),
    monthlyAttestation: absUrl(d.monthlyAttestationReports),
    companyName: d.companyInfo?.companyName ?? null,
    description: d.companyInfo?.description ?? null,
    ceo: d.companyInfo?.ceo ?? null,
    industry: d.companyInfo?.industry ?? null,
    homepageUrl: d.companyInfo?.homepageUrl || null,
    riskNotes,
  };
}
