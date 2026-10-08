/** Per-asset market / corporate-action status. */

const STATUS_URL =
  "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/asset/market/status/ai";

export type AssetMarketStatus = {
  openState: boolean;
  marketStatus: string | null;
  reasonCode: string | null;
  reasonMsg: string | null;
  nextOpenTime: number | null;
  nextCloseTime: number | null;
};

export async function fetchAssetMarketStatus(
  contractAddress: string,
  chainId = "56",
): Promise<AssetMarketStatus | null> {
  const url = `${STATUS_URL}?chainId=${chainId}&contractAddress=${contractAddress}`;
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
      openState?: boolean;
      marketStatus?: string;
      reasonCode?: string;
      reasonMsg?: string | null;
      nextOpenTime?: number | null;
      nextCloseTime?: number | null;
    };
  };
  if (!json.data || (json.code && json.code !== "000000" && !json.success)) {
    return null;
  }
  const d = json.data;
  return {
    openState: Boolean(d.openState),
    marketStatus: d.marketStatus ?? null,
    reasonCode: d.reasonCode ?? null,
    reasonMsg: d.reasonMsg ?? null,
    nextOpenTime: d.nextOpenTime ?? null,
    nextCloseTime: d.nextCloseTime ?? null,
  };
}

export function corporateActionLabel(reasonMsg: string | null) {
  if (!reasonMsg) return null;
  const map: Record<string, string> = {
    cash_dividend: "Cash dividend",
    stock_dividend: "Stock dividend",
    stock_split: "Stock split",
    merger: "Merger",
    acquisition: "Acquisition",
    spinoff: "Spinoff",
    maintenance: "Maintenance",
    earnings: "Earnings",
    "corporate action": "Corporate action",
  };
  return map[reasonMsg.toLowerCase()] || reasonMsg;
}
