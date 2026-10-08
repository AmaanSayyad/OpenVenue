/** Client-side persistence for watchlist + trade history. */

export type WatchItem = {
  ticker: string;
  addedAt: string;
  alertSpreadBps?: number;
};

export type HistoryItem = {
  id: string;
  at: string;
  side: "buy" | "sell" | "approve" | "park";
  ticker: string;
  symbol?: string;
  amountLabel: string;
  txHash?: string;
  mode?: string;
  vendor?: string;
  status: "submitted" | "confirmed" | "failed";
};

const WATCH_KEY = "venue.watchlist.v1";
const HIST_KEY = "venue.history.v1";

export function loadWatchlist(): WatchItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchItem[]) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(items.slice(0, 40)));
}

export function toggleWatch(ticker: string): WatchItem[] {
  const t = ticker.toUpperCase();
  const cur = loadWatchlist();
  const exists = cur.find((x) => x.ticker === t);
  const next = exists
    ? cur.filter((x) => x.ticker !== t)
    : [...cur, { ticker: t, addedAt: new Date().toISOString(), alertSpreadBps: 50 }];
  saveWatchlist(next);
  return next;
}

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
  } catch {
    return [];
  }
}

export function pushHistory(item: Omit<HistoryItem, "id" | "at"> & { id?: string; at?: string }) {
  const cur = loadHistory();
  const row: HistoryItem = {
    id: item.id || crypto.randomUUID(),
    at: item.at || new Date().toISOString(),
    ...item,
  };
  const next = [row, ...cur].slice(0, 100);
  localStorage.setItem(HIST_KEY, JSON.stringify(next));
  return next;
}

export function updateHistory(
  id: string,
  patch: Partial<HistoryItem>,
): HistoryItem[] {
  const cur = loadHistory();
  const next = cur.map((h) => (h.id === id ? { ...h, ...patch } : h));
  localStorage.setItem(HIST_KEY, JSON.stringify(next));
  return next;
}
