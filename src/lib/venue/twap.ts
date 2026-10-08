/** Local Limit / TWAP desk orders (client persistence). */

export type DeskOrderKind = "limit" | "twap";

export type DeskOrder = {
  id: string;
  kind: DeskOrderKind;
  ticker: string;
  side: "buy" | "sell";
  amountUsdt: number;
  /** Limit: max acceptable spread bps vs reference (buy) */
  limitSpreadBps?: number;
  /** TWAP: duration hours */
  durationHours?: number;
  slices?: number;
  status: "active" | "paused" | "filled" | "cancelled";
  createdAt: string;
  note?: string;
};

const KEY = "venue.twap.v1";

function read(): DeskOrder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function loadDeskOrders(): DeskOrder[] {
  return read();
}

export function saveDeskOrders(items: DeskOrder[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 40)));
  return items;
}

export function pushDeskOrder(
  item: Omit<DeskOrder, "id" | "createdAt" | "status"> & {
    id?: string;
    status?: DeskOrder["status"];
  },
): DeskOrder[] {
  const row: DeskOrder = {
    id: item.id || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: item.status || "active",
    kind: item.kind,
    ticker: item.ticker.toUpperCase(),
    side: item.side,
    amountUsdt: item.amountUsdt,
    limitSpreadBps: item.limitSpreadBps,
    durationHours: item.durationHours,
    slices: item.slices,
    note: item.note,
  };
  return saveDeskOrders([row, ...read()]);
}

export function updateDeskOrder(
  id: string,
  patch: Partial<DeskOrder>,
): DeskOrder[] {
  return saveDeskOrders(read().map((o) => (o.id === id ? { ...o, ...patch } : o)));
}
