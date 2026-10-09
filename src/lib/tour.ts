export type DeskTab =
  | "explore"
  | "trade"
  | "portfolio"
  | "watch"
  | "orders"
  | "strategies"
  | "park"
  | "agent"
  | "tape";

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

export const TOUR_STORAGE_KEY = "venue.tour.v1";
export const TOUR_STEP_KEY = "venue.tour.step.v1";

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
    title: "Trade the session, not the ticker.",
    body: "OpenVenue routes tokenized stocks on BNB Chain. It picks the wrapper that can fill now. You sign in MetaMask.",
    tab: "explore",
    cta: "Show the desk",
  },
  {
    id: "desks",
    phase: "desk",
    title: "One wallet, every view",
    body: "Explore, trade, portfolio, park, and orders. Moving between them does not disconnect the wallet.",
    target: "desks",
    tab: "explore",
  },
  {
    id: "markets",
    phase: "desk",
    title: "Pick a name",
    body: "Live marks for the names on the desk. Open one and the trade ticket loads with that ticker.",
    target: "markets",
    tab: "explore",
    cta: "Open a ticket",
  },
  {
    id: "session",
    phase: "ticket",
    title: "The US session sets the route",
    body: "Pre-market and after hours prefer on-chain pools. When the US session is open, quote venues are usually deeper.",
    target: "session",
    tab: "trade",
    ticker: "NVDA",
  },
  {
    id: "ticket",
    phase: "ticket",
    title: "Review, then sign",
    body: "Amount, venue, and spread sit on the ticket. A simulation gate stops a trade that would revert. Nothing is sent until MetaMask confirms.",
    target: "ticket",
    tab: "trade",
    ticker: "NVDA",
    cta: "Show park",
  },
  {
    id: "park",
    phase: "ticket",
    title: "Park idle USDT",
    body: "When you are not in a stock, park USDT on BNB Chain. One click asks for the approval, then the deposit. Unpark brings it back.",
    target: "park",
    tab: "park",
  },
  {
    id: "orders",
    phase: "book",
    title: "Limits wait for the spread",
    body: "A limit stays on this page and signs when the quote is close enough. Off-hours, the band widens so a pre-market pool can still fill.",
    target: "orders",
    tab: "orders",
  },
  {
    id: "portfolio",
    phase: "book",
    title: "Holdings and the trail",
    body: "Wallet balances, a sell from what you hold, and the receipt trail. Failed trades stay here with the reason.",
    target: "portfolio",
    tab: "portfolio",
  },
  {
    id: "agent",
    phase: "book",
    title: "Ask in one sentence",
    body: "“Buy $15 of NVDA” opens the ticket. Park opens earn. You still sign the transaction.",
    target: "agent",
    tab: "agent",
  },
  {
    id: "connect",
    phase: "book",
    title: "Connect on BNB Chain",
    body: "MetaMask on BNB Smart Chain. Balances, park, and sells use this wallet.",
    target: "connect",
    tab: "explore",
    waitForWallet: true,
    cta: "Connect wallet",
  },
];
