/** Receipts + cost-basis persistence for the Venue desk. */

export type TradeReceipt = {
  id: string;
  at: string;
  side: "buy" | "sell" | "approve" | "park";
  ticker: string;
  symbol?: string;
  wrapperKind?: string;
  vendor?: string;
  mode?: string;
  amountLabel: string;
  amountUsdt?: number;
  outAmountHuman?: string;
  quoteId?: string;
  simOk?: boolean | null;
  txHash?: string;
  status: "submitted" | "confirmed" | "failed";
  failReason?: string;
  sessionState?: string;
  notes?: string[];
};

export type CostBasisLot = {
  ticker: string;
  symbol: string;
  contractAddress: string;
  qty: number;
  costUsdt: number;
  avgPrice: number;
  updatedAt: string;
};

const RECEIPT_KEY = "venue.receipts.v1";
const BASIS_KEY = "venue.costbasis.v1";
const ALERT_KEY = "venue.alerts.v1";

export type DeskAlert = {
  id: string;
  at: string;
  kind: "spread" | "session" | "price" | "info";
  title: string;
  body: string;
  ticker?: string;
  read: boolean;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadReceipts(): TradeReceipt[] {
  return readJson<TradeReceipt[]>(RECEIPT_KEY, []);
}

export function pushReceipt(
  item: Omit<TradeReceipt, "id" | "at"> & { id?: string; at?: string },
): TradeReceipt[] {
  const row: TradeReceipt = {
    id: item.id || crypto.randomUUID(),
    at: item.at || new Date().toISOString(),
    ...item,
  };
  const next = [row, ...loadReceipts()].slice(0, 100);
  writeJson(RECEIPT_KEY, next);
  return next;
}

export function updateReceipt(
  id: string,
  patch: Partial<TradeReceipt>,
): TradeReceipt[] {
  const next = loadReceipts().map((r) => (r.id === id ? { ...r, ...patch } : r));
  writeJson(RECEIPT_KEY, next);
  return next;
}

export function loadCostBasis(): CostBasisLot[] {
  return readJson<CostBasisLot[]>(BASIS_KEY, []);
}

export function recordBuyLot(opts: {
  ticker: string;
  symbol: string;
  contractAddress: string;
  qty: number;
  costUsdt: number;
}): CostBasisLot[] {
  const lots = loadCostBasis();
  const key = opts.contractAddress.toLowerCase();
  const existing = lots.find((l) => l.contractAddress.toLowerCase() === key);
  if (existing) {
    const qty = existing.qty + opts.qty;
    const costUsdt = existing.costUsdt + opts.costUsdt;
    existing.qty = qty;
    existing.costUsdt = costUsdt;
    existing.avgPrice = qty > 0 ? costUsdt / qty : 0;
    existing.updatedAt = new Date().toISOString();
  } else {
    lots.push({
      ticker: opts.ticker,
      symbol: opts.symbol,
      contractAddress: key,
      qty: opts.qty,
      costUsdt: opts.costUsdt,
      avgPrice: opts.qty > 0 ? opts.costUsdt / opts.qty : 0,
      updatedAt: new Date().toISOString(),
    });
  }
  writeJson(BASIS_KEY, lots);
  return lots;
}

export function recordSellLot(opts: {
  contractAddress: string;
  qty: number;
}): CostBasisLot[] {
  const lots = loadCostBasis();
  const key = opts.contractAddress.toLowerCase();
  const existing = lots.find((l) => l.contractAddress.toLowerCase() === key);
  if (!existing) return lots;
  const qty = Math.max(0, existing.qty - opts.qty);
  if (qty <= 1e-12) {
    const next = lots.filter((l) => l.contractAddress.toLowerCase() !== key);
    writeJson(BASIS_KEY, next);
    return next;
  }
  const ratio = qty / existing.qty;
  existing.qty = qty;
  existing.costUsdt = existing.costUsdt * ratio;
  existing.avgPrice = existing.costUsdt / qty;
  existing.updatedAt = new Date().toISOString();
  writeJson(BASIS_KEY, lots);
  return lots;
}

export function loadAlerts(): DeskAlert[] {
  return readJson<DeskAlert[]>(ALERT_KEY, []);
}

export function pushAlert(
  item: Omit<DeskAlert, "id" | "at" | "read"> & {
    id?: string;
    at?: string;
    read?: boolean;
  },
): DeskAlert[] {
  const row: DeskAlert = {
    id: item.id || crypto.randomUUID(),
    at: item.at || new Date().toISOString(),
    read: item.read ?? false,
    kind: item.kind,
    title: item.title,
    body: item.body,
    ticker: item.ticker,
  };
  const next = [row, ...loadAlerts()].slice(0, 40);
  writeJson(ALERT_KEY, next);
  return next;
}

export function markAlertsRead(): DeskAlert[] {
  const next = loadAlerts().map((a) => ({ ...a, read: true }));
  writeJson(ALERT_KEY, next);
  return next;
}
