export type DeskTab =
  | "explore"
  | "trade"
  | "portfolio"
  | "watch"
  | "orders"
  | "park"
  | "agent";

export type TourPhase = "desk" | "ticket" | "book";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  phase: TourPhase;
  target?: string;
  tab?: DeskTab;
  ticker?: string;
  waitForWallet?: boolean;
  cta?: string;
};

/** Bump when copy/steps change so first-visit users get the new guide. */
export const TOUR_STORAGE_KEY = "venue.tour.v2";
export const TOUR_STEP_KEY = "venue.tour.step.v2";

export const TOUR_PHASE_LABEL: Record<TourPhase, string> = {
  desk: "The desk",
  ticket: "The ticket",
  book: "The book",
};

export function resolveStepHref(step: TourStep): string | null {
  if (!step.tab) return null;
  const q = new URLSearchParams();
  q.set("tab", step.tab);
  if (step.ticker) q.set("ticker", step.ticker);
  return `/app?${q.toString()}`;
}

export function stepLocationMatches(
  pathname: string,
  search: string,
  href: string,
) {
  const path = pathname.toLowerCase().split("?")[0] ?? "";
  if (path !== "/app" && !path.startsWith("/app/")) return false;
  let want: URLSearchParams;
  try {
    want = new URL(href, "http://local").searchParams;
  } catch {
    return false;
  }
  const have = new URLSearchParams(search);
  const wantTab = want.get("tab") || "explore";
  const haveTab = have.get("tab") || "explore";
  if (wantTab !== haveTab) return false;
  const ticker = want.get("ticker");
  if (ticker && (have.get("ticker") || "").toUpperCase() !== ticker.toUpperCase()) {
    return false;
  }
  return true;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "why",
    phase: "desk",
    title: "One intent. Best wrapper. Fees on Monad.",
    body: "Say “buy NVDA.” OpenVenue compares Anchored, bStocks, Ondo, and xStocks, picks a live route, and you sign in MetaMask. Platform fees and Park always settle on Monad — even when the stock fill hops to BNB Chain.",
    tab: "explore",
    cta: "Show the desk",
  },
  {
    id: "desks",
    phase: "desk",
    title: "One wallet, every view",
    body: "Explore, Trade, Portfolio, Orders, Park, and Agent share the same MetaMask session. Switching tabs does not disconnect.",
    target: "desks",
    tab: "explore",
  },
  {
    id: "markets",
    phase: "desk",
    title: "Pick a name",
    body: "Live marks for the names on the desk. Open one and the trade ticket loads with that ticker and a cross-wrapper compare.",
    target: "markets",
    tab: "explore",
    cta: "Open a ticket",
  },
  {
    id: "session",
    phase: "ticket",
    title: "The US session sets the route",
    body: "Pre-market and after hours prefer AMM / off-hours pools. When the US session is open, quote venues are usually deeper. The banner tells you which mode you are in.",
    target: "session",
    tab: "trade",
    ticker: "NVDA",
  },
  {
    id: "ticket",
    phase: "ticket",
    title: "Pay the venue’s stable — fee on Monad",
    body: "BNB Chain wrappers (bStocks / Ondo / xStocks) spend USDT on BSC. Monad venues use USDC. The ticket shows which. After the fill, OpenVenue settles the 15 bps platform fee on Monad.",
    target: "ticket",
    tab: "trade",
    ticker: "NVDA",
    cta: "Show park",
  },
  {
    id: "park",
    phase: "ticket",
    title: "Park idle USDC on Monad",
    body: "When you are not in a stock, park Circle USDC into Aave V3 on Monad. Approve once, then supply. Unpark withdraws anytime. Compare-only pools are listed for rates — one-click uses Aave.",
    target: "park",
    tab: "park",
  },
  {
    id: "orders",
    phase: "book",
    title: "Limits stay on Monad",
    body: "Orders are denominated in USDC and only auto-sign a Monad venue inside your spread band. BNB Chain wrapper fills stay on Trade — this desk will not switch you there.",
    target: "orders",
    tab: "orders",
  },
  {
    id: "portfolio",
    phase: "book",
    title: "Holdings across both chains",
    body: "MON and USDC on Monad, plus tokenized stocks this wallet holds on Monad or BNB Chain (e.g. AAPLon). Sell from a row, or open Trade. Activity keeps local receipts — Pending means the wallet never confirmed that hop.",
    target: "portfolio",
    tab: "portfolio",
  },
  {
    id: "agent",
    phase: "book",
    title: "Ask in one sentence",
    body: "“Buy $15 of NVDA” opens the ticket with the best live route. “Park USDC” jumps to earn. You still sign every transaction in MetaMask.",
    target: "agent",
    tab: "agent",
  },
  {
    id: "connect",
    phase: "book",
    title: "Connect on Monad",
    body: "Use MetaMask with Monad Mainnet (143) as home. Stock fills may ask to switch to BNB Chain briefly; fee and Park return to Monad.",
    target: "connect",
    tab: "explore",
    waitForWallet: true,
    cta: "Connect wallet",
  },
];
