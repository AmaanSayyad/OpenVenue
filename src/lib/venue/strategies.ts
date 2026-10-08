/** Saved one-tap desk strategies (local). */

export type DeskStrategy = {
  id: string;
  name: string;
  description: string;
  ticker: string;
  amountUsdt: number;
  maxSpreadBps: number;
  parkIfNoQuote: boolean;
  createdAt: string;
};

const KEY = "venue.strategies.v1";

const DEFAULTS: DeskStrategy[] = [
  {
    id: "best-under-20",
    name: "Best under 20 bps",
    description: "Buy best venue if spread ≤ 20 bps; else park USDT.",
    ticker: "NVDA",
    amountUsdt: 15,
    maxSpreadBps: 20,
    parkIfNoQuote: true,
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "tight-tsla",
    name: "Tight TSLA",
    description: "Buy TSLA only when spread ≤ 10 bps.",
    ticker: "TSLA",
    amountUsdt: 25,
    maxSpreadBps: 10,
    parkIfNoQuote: false,
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "size-aapl",
    name: "Size AAPL",
    description: "$50 AAPL best venue, park on miss.",
    ticker: "AAPL",
    amountUsdt: 50,
    maxSpreadBps: 30,
    parkIfNoQuote: true,
    createdAt: new Date(0).toISOString(),
  },
];

function read(): DeskStrategy[] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
      return DEFAULTS;
    }
    return JSON.parse(raw) as DeskStrategy[];
  } catch {
    return DEFAULTS;
  }
}

export function loadStrategies(): DeskStrategy[] {
  return read();
}

export function saveStrategies(items: DeskStrategy[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 20)));
  return items;
}

export function upsertStrategy(
  item: Omit<DeskStrategy, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): DeskStrategy[] {
  const cur = read();
  const row: DeskStrategy = {
    id: item.id || crypto.randomUUID(),
    createdAt: item.createdAt || new Date().toISOString(),
    name: item.name,
    description: item.description,
    ticker: item.ticker.toUpperCase(),
    amountUsdt: item.amountUsdt,
    maxSpreadBps: item.maxSpreadBps,
    parkIfNoQuote: item.parkIfNoQuote,
  };
  const next = [row, ...cur.filter((s) => s.id !== row.id)].slice(0, 20);
  return saveStrategies(next);
}

export function removeStrategy(id: string): DeskStrategy[] {
  return saveStrategies(read().filter((s) => s.id !== id));
}
