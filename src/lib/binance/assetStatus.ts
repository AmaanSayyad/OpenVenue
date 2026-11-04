export function corporateActionLabel(msg?: string | null) {
  if (!msg) return null;
  if (/split/i.test(msg)) return "Stock split";
  if (/dividend/i.test(msg)) return "Dividend";
  if (/pause/i.test(msg)) return "Trading paused";
  return msg;
}

export async function fetchAssetMarketStatus(contract: string) {
  return {
    ok: true as const,
    contract,
    marketStatus: "open",
    chain: "monad",
    nextOpenTime: null as string | null,
    reasonCode: null as string | null,
    reasonMsg: null as string | null,
    openState: true,
  };
}
