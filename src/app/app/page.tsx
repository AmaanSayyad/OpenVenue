"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAppKit } from "@reown/appkit/react";
import {
  useAccount,
  usePublicClient,
  useSendTransaction,
  useSignTypedData,
  useWaitForTransactionReceipt,
} from "wagmi";
import "@/config/appkit";
import { type Hex, type Address, decodeFunctionData, encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Sparkline } from "@/components/Sparkline";
import { PriceChart } from "@/components/PriceChart";
import { PortfolioView } from "@/components/PortfolioView";
import { ReceiptModal } from "@/components/ReceiptModal";
import { SessionAutopilot } from "@/components/SessionAutopilot";
import { WrapperCompare } from "@/components/WrapperCompare";
import { AlertBell } from "@/components/AlertBell";
import { EmptyState, ErrorBanner } from "@/components/EmptyState";
import { TradeSheet } from "@/components/TradeSheet";
import { TapeSellPanel } from "@/components/TapeSellPanel";
import { ExploreMarkets } from "@/components/ExploreMarkets";
import { AlsoOwnSection } from "@/components/AlsoOwnSection";
import { AssetStats } from "@/components/AssetStats";
import { CorporateActionBanner } from "@/components/CorporateActionBanner";
import { FeePreview } from "@/components/FeePreview";
import { VendorName } from "@/components/VendorMark";
import { FillStatus } from "@/components/FillStatus";
import { QuoteExpiry, quoteExpired, QUOTE_TTL_MS } from "@/components/QuoteExpiry";
import { TwapDesk } from "@/components/TwapDesk";
import { loadDeskOrders, updateDeskOrder } from "@/lib/venue/twap";
import { SavedStrategies } from "@/components/SavedStrategies";
import type { DeskStrategy } from "@/lib/venue/strategies";
import Image from "next/image";
import type { VenueDecision } from "@/lib/venue/types";
import { kindLabel } from "@/lib/venue/types";
import { usdtAmountToWei } from "@/lib/venue/amount";
import {
  loadHistory,
  loadWatchlist,
  pushHistory,
  toggleWatch,
  type HistoryItem,
  type WatchItem,
} from "@/lib/venue/local";
import {
  loadAlerts,
  loadCostBasis,
  loadReceipts,
  pushAlert,
  pushReceipt,
  recordBuyLot,
  recordSellLot,
  type CostBasisLot,
  type DeskAlert,
  type TradeReceipt,
} from "@/lib/venue/receipts";
import { CORE_TICKERS, tickerMeta } from "@/lib/venue/tickers";
import clsx from "clsx";

type Tab =
  | "explore"
  | "trade"
  | "portfolio"
  | "watch"
  | "history"
  | "orders"
  | "strategies"
  | "agent"
  | "park"
  | "tape";

function AboutCopy({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const limit = 168;
  const long = text.length > limit;
  const shown =
    open || !long ? text : text.slice(0, limit).replace(/\s+\S*$/, "");

  return (
    <p className="mt-3 text-[15px] leading-[1.6] text-[var(--ink)]">
      {shown}
      {long && !open ? "… " : long ? " " : null}
      {long && (
        <button
          type="button"
          className="font-semibold underline decoration-black/25 underline-offset-2"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </p>
  );
}

export default function AppPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col bg-[#f7f7f7] pb-24 lg:pb-0">
          <SiteHeader variant="solid" />
          <div className="mx-auto max-w-6xl px-5 pt-28 text-sm text-[var(--ink-soft)]">
            Loading desk…
          </div>
        </main>
      }
    >
      <AppPageInner />
    </Suspense>
  );
}

function AppPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();

  const [tab, setTab] = useState<Tab>("explore");
  const chooseTab = (next: Tab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    if ((params.get("tab") || "explore") === next) return;
    params.set("tab", next);
    router.replace(`/app?${params.toString()}`, { scroll: false });
  };
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [ticker, setTicker] = useState("NVDA");
  const [amount, setAmount] = useState("15");
  const [parkAmount, setParkAmount] = useState("1");
  const [slippage, setSlippage] = useState("1.5");
  const [mev, setMev] = useState(true);
  const [requireSim, setRequireSim] = useState(true);
  const [session, setSession] = useState<{
    state: string;
    label: string;
    nextOpenIso: string;
  } | null>(null);
  const [decision, setDecision] = useState<VenueDecision | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [txKind, setTxKind] = useState<"trade" | "park" | "unpark">("trade");
  const [txSummary, setTxSummary] = useState<string | null>(null);
  const [unparkPending, setUnparkPending] = useState(false);
  const [parkBusy, setParkBusy] = useState(false);
  const parkLock = useRef(false);
  const [autopilot, setAutopilot] = useState<string[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [portfolio, setPortfolio] = useState<Record<string, unknown> | null>(null);
  const [parkOptions, setParkOptions] = useState<
    Array<{
      investmentId: string;
      protocolName: string;
      protocolLogo?: string;
      poolName?: string;
      apyDisplay: string;
      tvlUsd?: number | null;
    }>
  >([]);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [watchQuotes, setWatchQuotes] = useState<
    Record<string, { last: number; change: number; changePct: number }>
  >({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [receipts, setReceipts] = useState<TradeReceipt[]>([]);
  const [activeReceipt, setActiveReceipt] = useState<TradeReceipt | null>(null);
  const [costBasis, setCostBasis] = useState<CostBasisLot[]>([]);
  const [alerts, setAlerts] = useState<DeskAlert[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pollEnabled, setPollEnabled] = useState(true);
  const [quoteAge, setQuoteAge] = useState<number | null>(null);
  const [quoteIsStale, setQuoteIsStale] = useState(false);
  const [pendingLot, setPendingLot] = useState<{
    ticker: string;
    symbol: string;
    contractAddress: string;
    qty: number;
    costUsdt: number;
    side: "buy" | "sell";
  } | null>(null);
  const [agentPrompt, setAgentPrompt] = useState("buy $15 NVDA best venue");
  const [agentOut, setAgentOut] = useState<unknown>(null);
  const [agentPending, setAgentPending] = useState(false);
  const [chartQuote, setChartQuote] = useState<{
    last: number;
    changePct: number;
    change: number;
  } | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const assetPickerRef = useRef<HTMLDivElement>(null);
  const pollBusy = useRef(false);
  const limitBusy = useRef(false);
  const armLimitRef = useRef<
    (
      opts: {
        id: string;
        ticker: string;
        amountUsdt: number;
        maxSpreadBps: number;
      },
      quiet?: boolean,
    ) => Promise<void>
  >(async () => {});
  const deepTicker = useRef<string | null>(null);
  const [sellPosition, setSellPosition] = useState<{
    symbol: string;
    ticker: string;
    contractAddress: string;
    balanceWei: string;
    balance: string;
  } | null>(null);

  const {
    isLoading: confirming,
    isSuccess: confirmed,
    isError: failed,
    error: fillError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    timeout: 45_000,
  });

  useEffect(() => {
    setWatch(loadWatchlist());
    setHistory(loadHistory());
    setReceipts(loadReceipts());
    setCostBasis(loadCostBasis());
    setAlerts(loadAlerts());
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setSession(d))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab !== "watch" || watch.length === 0) return;
    let cancel = false;
    (async () => {
      for (const item of watch) {
        if (cancel) return;
        try {
          const d = await fetch(
            `/api/venue/chart?ticker=${encodeURIComponent(item.ticker)}&range=1D`,
          ).then((r) => r.json());
          if (cancel || !d.ok || typeof d.last !== "number") continue;
          setWatchQuotes((prev) => ({
            ...prev,
            [item.ticker]: {
              last: d.last,
              change: Number(d.change) || 0,
              changePct: Number(d.changePct) || 0,
            },
          }));
        } catch {
          /* keep the card without a live price */
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [tab, watch]);

  // Deep-link from navbar search: /app?tab=trade&ticker=NVDA
  useEffect(() => {
    const t = searchParams.get("ticker")?.trim().toUpperCase() || "";
    const tabParam = searchParams.get("tab") as Tab | null;
    if (t && t !== deepTicker.current) {
      deepTicker.current = t;
      setTicker(t);
      setSide("buy");
      setSellPosition(null);
      setDecision(null);
      setSelectedQuoteId(null);
    }
    if (t) {
      const tabsOk = [
        "explore",
        "trade",
        "portfolio",
        "watch",
        "orders",
        "strategies",
        "agent",
        "park",
        "tape",
      ];
      setTab(
        tabParam === "history"
          ? "portfolio"
          : tabParam && tabsOk.includes(tabParam)
            ? tabParam
            : "trade",
      );
    } else if (tabParam === "history") {
      setTab("portfolio");
    } else if (
      tabParam &&
      [
        "explore",
        "trade",
        "portfolio",
        "watch",
        "orders",
        "strategies",
        "agent",
        "park",
        "tape",
      ].includes(tabParam)
    ) {
      setTab(tabParam);
    }
  }, [searchParams]);


  useEffect(() => {
    setQuoteIsStale(quoteAge == null);
  }, [quoteAge]);

  useEffect(() => {
    setChartQuote(null);
  }, [ticker]);

  useEffect(() => {
    if (!assetPickerOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!assetPickerRef.current?.contains(e.target as Node)) {
        setAssetPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAssetPickerOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [assetPickerOpen]);

  const selectTicker = useCallback((t: string) => {
    setTicker(t);
    setDecision(null);
    setSelectedQuoteId(null);
    setAutopilot([]);
    setMeta(null);
    setError(null);
    setStatus(null);
    setAssetPickerOpen(false);
    setAssetSearch("");
    setAgentPending(false);
  }, []);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/venue/wallet-status?wallet=${address}`)
      .then((r) => r.json())
      .catch(() => undefined);
  }, [address]);

  const amountWei = useMemo(() => {
    try {
      return usdtAmountToWei(Number(amount)).toString();
    } catch {
      return null;
    }
  }, [amount]);

  const selected = useMemo(() => {
    if (!decision) return null;
    const match = decision.quotes.find(
      (q) => q.ok && q.route?.quoteId === selectedQuoteId,
    );
    if (match?.route) {
      return {
        candidate: match.candidate,
        route: match.route,
        outAmountHuman: match.outAmountHuman || "",
      };
    }
    return decision.bestQuote;
  }, [decision, selectedQuoteId]);

  const filteredTickers = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return CORE_TICKERS;
    return CORE_TICKERS.filter((t) => {
      const m = tickerMeta(t);
      return (
        t.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.onSymbol.toLowerCase().includes(q) ||
        `${t}on`.toLowerCase().includes(q) ||
        `${t}b`.toLowerCase().includes(q) ||
        `${t}x`.toLowerCase().includes(q)
      );
    });
  }, [assetSearch]);

  type PickerHit = {
    ticker: string;
    name: string;
    symbol: string;
    logo: string;
  };
  const [pickerHits, setPickerHits] = useState<PickerHit[] | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    if (!assetPickerOpen) return;
    const q = assetSearch.trim();
    if (!q) {
      setPickerHits(null);
      setPickerLoading(false);
      return;
    }
    const ac = new AbortController();
    setPickerLoading(true);
    const id = setTimeout(() => {
      fetch(`/api/venue/search?q=${encodeURIComponent(q)}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((d) => {
          if (!d.ok || !Array.isArray(d.results)) return;
          setPickerHits(
            d.results.map(
              (r: {
                ticker: string;
                symbol: string;
                name: string;
                logo?: string;
              }) => {
                const m = tickerMeta(r.ticker || r.symbol);
                return {
                  ticker: r.ticker || m.onSymbol,
                  name: r.name || m.name,
                  symbol: r.symbol || m.onSymbol,
                  logo: r.logo && !r.logo.endsWith("mark.svg") ? r.logo : m.logo,
                };
              },
            ),
          );
        })
        .catch(() => undefined)
        .finally(() => {
          if (!ac.signal.aborted) setPickerLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, [assetSearch, assetPickerOpen]);

  const pickerRows: PickerHit[] =
    assetSearch.trim() && pickerHits
      ? pickerHits
      : filteredTickers.map((t) => {
          const m = tickerMeta(t);
          return { ticker: t, name: m.name, symbol: m.onSymbol, logo: m.logo };
        });

  const resolve = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
        setStatus(null);
        setDecision(null);
        setSelectedQuoteId(null);
        setMeta(null);
      }
      try {
        const qs = new URLSearchParams({
          ticker: ticker.trim(),
          amount: amount.trim() || "15",
          side,
        });
        if (address) qs.set("wallet", address);
        if (side === "sell" && sellPosition) {
          qs.set("fromToken", sellPosition.contractAddress);
          qs.set("fromAmountWei", sellPosition.balanceWei);
          qs.set("ticker", sellPosition.ticker);
        }
        const res = await fetch(`/api/venue/resolve?${qs}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Resolve failed");
        setDecision(json.decision);
        setQuoteAge(Date.now());
        if (json.decision.bestQuote?.route?.quoteId) {
          setSelectedQuoteId(json.decision.bestQuote.route.quoteId);
        }
        // Cross-wrapper arb alert (Ondo vs bStock vs xStock)
        const liveQuotes = (
          json.decision.quotes as VenueDecision["quotes"]
        ).filter((q) => q.ok && q.candidate.onChainPrice != null);
        if (liveQuotes.length >= 2) {
          const prices = liveQuotes.map((q) => q.candidate.onChainPrice!);
          const lo = Math.min(...prices);
          const hi = Math.max(...prices);
          const arbBps = lo > 0 ? ((hi - lo) / lo) * 10_000 : 0;
          if (arbBps >= 25) {
            const cheap = liveQuotes.find((q) => q.candidate.onChainPrice === lo);
            const rich = liveQuotes.find((q) => q.candidate.onChainPrice === hi);
            setAlerts(
              pushAlert({
                kind: "spread",
                ticker,
                title: `${ticker} wrappers are apart`,
                body: `${cheap?.candidate.symbol} is cheaper than ${rich?.candidate.symbol} by about ${(arbBps / 100).toFixed(2)}%.`,
              }),
            );
          }
        }

        const watchlist = loadWatchlist();
        for (const w of watchlist) {
          const cand = (json.decision.quotes as VenueDecision["quotes"]).find(
            (q) =>
              q.candidate.symbol.toUpperCase().startsWith(w.ticker) ||
              w.ticker === ticker,
          );
          if (
            cand?.candidate.spreadBps != null &&
            w.alertSpreadBps != null &&
            cand.candidate.spreadBps >= w.alertSpreadBps
          ) {
            setAlerts(
              pushAlert({
                kind: "spread",
                ticker: w.ticker,
                title: `${w.ticker} quote is wide`,
                body: `${cand.candidate.symbol} is ${(cand.candidate.spreadBps / 100).toFixed(2)}% from the reference. Your watch is ${(w.alertSpreadBps / 100).toFixed(2)}%.`,
              }),
            );
          }
        }
        if (
          (json.decision.session === "open" ||
            json.decision.session === "pre_market") &&
          !opts?.silent
        ) {
          const watched = watchlist.find((w) => w.ticker === ticker);
          if (watched) {
            setAlerts(
              pushAlert({
                kind: "session",
                ticker,
                title: `US session · ${String(json.decision.session).replace("pre_market", "pre-market").replace("after_hours", "after hours")}`,
                body: json.decision.sessionLabel || json.decision.reason,
              }),
            );
          }
        }

        if (!opts?.silent) {
          const tips = await fetch(
            `/api/venue/ladder?ticker=${encodeURIComponent(
              side === "sell" && sellPosition ? sellPosition.ticker : ticker,
            )}&sizes=15,50,200${address ? `&wallet=${address}` : ""}`,
          ).then((r) => r.json());
          if (tips.ok) {
            setAutopilot(tips.autopilot?.tips || []);
          }
          const bestAddr =
            json.decision.bestQuote?.candidate?.contractAddress ||
            json.decision.recommended?.contractAddress;
          if (bestAddr) {
            const m = await fetch(`/api/venue/meta?contract=${bestAddr}`).then(
              (r) => r.json(),
            );
            if (m.ok) setMeta(m.meta);
          }
        }
        if (json.decision.fallback === "park_defi") {
          const park = await fetch("/api/venue/park").then((r) => r.json());
          if (park.ok) setParkOptions(park.items || []);
        }
      } catch (e) {
        if (!opts?.silent) {
          setError(e instanceof Error ? e.message : "Failed to resolve venue");
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [ticker, amount, address, side, sellPosition],
  );

  useEffect(() => {
    if (!pollEnabled || tab !== "trade" || !decision || building || loading) return;
    const id = setInterval(async () => {
      if (pollBusy.current) return;
      pollBusy.current = true;
      try {
        await resolve({ silent: true });
      } finally {
        pollBusy.current = false;
      }
    }, 12_000);
    return () => clearInterval(id);
  }, [pollEnabled, tab, decision, building, loading, resolve]);

  const loadPortfolio = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/venue/portfolio?wallet=${address}`).then(
        (r) => r.json(),
      );
      if (!res.ok) throw new Error(res.error || "Portfolio failed");
      setPortfolio(res.portfolio);
      setCostBasis(loadCostBasis());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portfolio failed");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (side !== "sell" || !address) return;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`/api/venue/portfolio?wallet=${address}`).then((r) =>
          r.json(),
        );
        if (cancel || !res.ok) return;
        const positions = (res.portfolio?.positions || []) as Array<{
          symbol: string;
          ticker: string;
          contractAddress: string;
          balance: string;
          balanceWei: string;
        }>;
        setPortfolio(res.portfolio);
        const want = ticker.toUpperCase();
        const matches = positions.filter((p) => {
          const sym = String(p.symbol || "").toUpperCase();
          const rowTicker = String(p.ticker || "").toUpperCase();
          return (
            Number(p.balance) > 0 &&
            (rowTicker === want || sym.startsWith(want))
          );
        });
        const pick =
          matches.find((p) => p.symbol.toUpperCase().endsWith("B")) || matches[0];
        if (!pick) {
          setSellPosition(null);
          return;
        }
        setSellPosition({
          symbol: pick.symbol,
          ticker: pick.ticker,
          contractAddress: pick.contractAddress,
          balanceWei: pick.balanceWei,
          balance: pick.balance,
        });
      } catch {
        if (!cancel) setSellPosition(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [side, address, ticker]);

  useEffect(() => {
    if (side !== "sell" || !sellPosition) return;
    void resolve();
  }, [side, sellPosition, resolve]);

  useEffect(() => {
    if ((tab === "portfolio" || tab === "explore" || tab === "park") && address)
      loadPortfolio();
    if (tab === "park") {
      fetch("/api/venue/park")
        .then((r) => r.json())
        .then((d) => d.ok && setParkOptions(d.items || []));
    }
  }, [tab, address, loadPortfolio]);

  useEffect(() => {
    if (!confirmed || !txHash) return;
    const next = loadHistory().map((h) =>
      h.txHash === txHash ? { ...h, status: "confirmed" as const } : h,
    );
    localStorage.setItem("venue.history.v1", JSON.stringify(next));
    setHistory(next);
    const rNext = loadReceipts().map((r) =>
      r.txHash === txHash ? { ...r, status: "confirmed" as const } : r,
    );
    localStorage.setItem("venue.receipts.v1", JSON.stringify(rNext));
    setReceipts(rNext);
    if (pendingLot) {
      if (pendingLot.side === "buy") {
        setCostBasis(
          recordBuyLot({
            ticker: pendingLot.ticker,
            symbol: pendingLot.symbol,
            contractAddress: pendingLot.contractAddress,
            qty: pendingLot.qty,
            costUsdt: pendingLot.costUsdt,
          }),
        );
      } else {
        setCostBasis(
          recordSellLot({
            contractAddress: pendingLot.contractAddress,
            qty: pendingLot.qty,
          }),
        );
      }
      setPendingLot(null);
      setAlerts(
        pushAlert({
          kind: "info",
          ticker: pendingLot.ticker,
          title: "Fill confirmed",
          body: "Cost basis for this position is updated.",
        }),
      );
    }
  }, [confirmed, txHash, pendingLot]);

  useEffect(() => {
    if (!failed || !txHash) return;
    setPendingLot(null);
    const reason =
      fillError instanceof Error
        ? fillError.message
        : "Transaction was not included";
    const next = loadHistory().map((h) =>
      h.txHash === txHash ? { ...h, status: "failed" as const } : h,
    );
    localStorage.setItem("venue.history.v1", JSON.stringify(next));
    setHistory(next);
    const rNext = loadReceipts().map((r) =>
      r.txHash === txHash
        ? { ...r, status: "failed" as const, failReason: reason }
        : r,
    );
    localStorage.setItem("venue.receipts.v1", JSON.stringify(rNext));
    setReceipts(rNext);
    setError(
      "This trade did not land on BSC. Resolve again and sign before the quote expires.",
    );
  }, [failed, txHash, fillError]);

  async function executeBest(opts?: {
    fromAgent?: boolean;
    pick?: NonNullable<VenueDecision["bestQuote"]>;
    amountUsdt?: number;
    tickerName?: string;
    sessionState?: string;
    skipStaleCheck?: boolean;
  }) {
    const pick = opts?.pick ?? selected;
    const tradeAmount =
      opts?.amountUsdt != null ? String(opts.amountUsdt) : amount;
    const tradeTicker = opts?.tickerName ?? ticker;
    if (!pick || !address) {
      setError("Connect a wallet and resolve a live route first.");
      return false;
    }
    if (!opts?.skipStaleCheck && quoteExpired(quoteAge, Date.now())) {
      setError("Quote expired - refresh the route before execute.");
      return false;
    }
    const tradeSide: "buy" | "sell" =
      opts?.pick && opts.amountUsdt != null ? "buy" : side;
    const fromToken =
      tradeSide === "sell" && !opts?.pick
        ? pick.candidate.contractAddress
        : "0x55d398326f99059fF775485246999027B3197955";
    const toToken =
      tradeSide === "sell" && !opts?.pick
        ? "0x55d398326f99059fF775485246999027B3197955"
        : pick.candidate.contractAddress;
    const amt =
      opts?.amountUsdt != null
        ? usdtAmountToWei(opts.amountUsdt).toString()
        : tradeSide === "sell"
          ? sellPosition?.balanceWei || pick.route.fromTokenAmount
          : amountWei;
    if (!amt) {
      setError("Invalid amount");
      return false;
    }
    if (publicClient && (tradeSide === "buy" || opts?.pick)) {
      const usdtBal = await publicClient.readContract({
        address: fromToken as Address,
        abi: [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "balance", type: "uint256" }],
          },
        ] as const,
        functionName: "balanceOf",
        args: [address],
      });
      if (usdtBal < BigInt(amt)) {
        const held = (Number(usdtBal) / 1e18).toFixed(2);
        setError(`This wallet has ${held} USDT. Lower the amount and try again.`);
        return false;
      }
    }

    setBuilding(true);
    setError(null);
    setAgentPending(false);
    setStatus("Building payload + simulation gate…");

    const receiptBase = {
      side: tradeSide,
      ticker:
        tradeSide === "sell" && sellPosition && !opts?.pick
          ? sellPosition.ticker
          : tradeTicker,
      symbol: pick.candidate.symbol,
      wrapperKind: pick.candidate.kind,
      vendor: pick.route.vendorName,
      mode: pick.route.executionMode,
      amountLabel:
        tradeSide === "sell" && !opts?.pick
          ? sellPosition?.balance || "?"
          : `${tradeAmount} USDT`,
      amountUsdt: tradeSide === "buy" || opts?.pick ? Number(tradeAmount) : undefined,
      outAmountHuman: pick.outAmountHuman,
      quoteId: pick.route.quoteId,
      sessionState: opts?.sessionState ?? decision?.session,
      notes: opts?.fromAgent ? ["Agent-confirmed execution"] : [],
    };

    try {
      setStatus("Refreshing the quote…");
      const refresh = new URLSearchParams({
        ticker: receiptBase.ticker,
        amount: tradeAmount.trim() || "1",
        side: tradeSide,
        wallet: address,
      });
      if (tradeSide === "sell" && !opts?.pick) {
        refresh.set("fromToken", fromToken);
        refresh.set("fromAmountWei", amt);
      }
      const fresh = await fetch(`/api/venue/resolve?${refresh}`).then((r) =>
        r.json(),
      );
      const best = fresh.decision?.bestQuote;
      if (!fresh.ok || !best?.route?.quoteId) {
        throw new Error(fresh.decision?.reason || fresh.error || "Quote refresh failed");
      }
      const buildBody = {
        quoteId: best.route.quoteId,
        fromTokenAddress: fromToken,
        toTokenAddress: toToken,
        amount: amt,
        userWalletAddress: address,
        vendor: best.route.vendorName,
        executionMode: best.route.executionMode,
        slippagePercent: slippage,
        simulate: true,
        requireSimOk: requireSim,
      };
      const res = await fetch("/api/venue/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody),
      });
      let json = await res.json();
      if (!json.ok) throw new Error(json.error || "Build failed");
      setQuoteAge(Date.now());

      const mode = String(json.executionMode || "SWAP").toUpperCase();
      setStatus(
        json.simOk === false
          ? "Simulation warning (gate off) - review carefully."
          : "Simulation OK.",
      );
      if (mode === "RFQ") {
        const rfq = (json.swap as {
          rfq?: {
            typedDataToSign?: unknown;
            orderId?: string;
            vendor?: string;
            vendorName?: string;
          };
        })?.rfq;
        const typed = rfq?.typedDataToSign as {
          domain: Record<string, unknown>;
          types: Record<string, Array<{ name: string; type: string }>>;
          message: Record<string, unknown>;
          primaryType?: string;
        };
        if (!typed?.domain || !typed?.types || !typed?.message) {
          throw new Error("RFQ payload missing typedDataToSign");
        }
        setStatus("Sign RFQ typed data…");
        const signature = await signTypedDataAsync({
          domain: typed.domain as Record<string, unknown>,
          types: typed.types as Record<
            string,
            { name: string; type: string }[]
          >,
          primaryType: typed.primaryType || "Order",
          message: typed.message as Record<string, unknown>,
        } as Parameters<typeof signTypedDataAsync>[0]);
        const vendor =
          rfq?.vendor || rfq?.vendorName || pick.route.vendorName;
        const quoteId = rfq?.orderId || pick.route.quoteId;
        const submit = await fetch("/api/venue/rfq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            quoteId,
            vendor,
            userSignature: signature,
          }),
        }).then((r) => r.json());
        if (!submit.ok) throw new Error(submit.error || "RFQ submit failed");
        const orderId =
          (submit.data as { orderId?: string })?.orderId || quoteId || "";
        setHistory(
          pushHistory({
            side: tradeSide,
            ticker: tradeTicker,
            symbol: pick.candidate.symbol,
            amountLabel: tradeAmount,
            mode: "RFQ",
            vendor: vendor || undefined,
            status: "submitted",
            txHash: orderId,
          }),
        );
        const next = pushReceipt({
          ...receiptBase,
          simOk: json.simOk ?? null,
          txHash: orderId,
          status: "submitted",
          mode: "RFQ",
          vendor: vendor || undefined,
        });
        setReceipts(next);
        setActiveReceipt(next[0]);
        setStatus(`RFQ submitted · ${orderId}`);
        setSheetOpen(false);
        return true;
      }

      const approveTx = json.approve as {
        to?: string;
        data?: string;
        value?: string;
        gas?: string;
      } | null;
      if (approveTx?.data && json.allowancePending) {
        setStatus("Approve spending…");
        const approveHash = await sendTransactionAsync({
          to: (approveTx.to || fromToken) as Address,
          data: approveTx.data as Hex,
          value: approveTx.value ? BigInt(approveTx.value) : undefined,
        });
        setTxKind("trade");
        setTxSummary(null);
        setTxHash(approveHash);
        setHistory(
          pushHistory({
            side: "approve",
            ticker: tradeTicker,
            amountLabel: tradeAmount,
            txHash: approveHash,
            status: "submitted",
          }),
        );
        pushReceipt({
          side: "approve",
          ticker: tradeTicker,
          amountLabel: tradeAmount,
          txHash: approveHash,
          status: "submitted",
          simOk: json.simOk ?? null,
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      if (json.allowancePending) {
        setStatus("Refreshing the quote…");
        const again = new URLSearchParams({
          ticker: receiptBase.ticker,
          amount: tradeAmount.trim() || "1",
          side: tradeSide,
          wallet: address,
        });
        if (tradeSide === "sell" && !opts?.pick) {
          again.set("fromToken", fromToken);
          again.set("fromAmountWei", amt);
        }
        const rebuiltQuote = await fetch(`/api/venue/resolve?${again}`).then((r) =>
          r.json(),
        );
        const nextBest = rebuiltQuote.decision?.bestQuote;
        if (!rebuiltQuote.ok || !nextBest?.route?.quoteId) {
          throw new Error(
            rebuiltQuote.decision?.reason || rebuiltQuote.error || "Quote refresh failed",
          );
        }
        const rebuilt = await fetch("/api/venue/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildBody,
            quoteId: nextBest.route.quoteId,
            vendor: nextBest.route.vendorName,
            executionMode: nextBest.route.executionMode,
          }),
        }).then((r) => r.json());
        if (!rebuilt.ok) throw new Error(rebuilt.error || "Rebuild failed");
        json = rebuilt;
        setQuoteAge(Date.now());
      }

      const tx = (json.swap as { tx?: Record<string, string> })?.tx;
      if (!tx?.to || !tx?.data) throw new Error("Swap tx missing");

      if (publicClient) {
        try {
          await publicClient.estimateGas({
            account: address,
            to: tx.to as Address,
            data: tx.data as Hex,
            value: tx.value ? BigInt(tx.value) : undefined,
          });
        } catch (err) {
          const detail = err instanceof Error ? err.message : "";
          throw new Error(
            /allowance/i.test(detail)
              ? "Spending is not approved yet. Try the trade again."
              : "This quote would fail on BSC. Resolve again and sign right away.",
          );
        }
      }

      setStatus(
        mev
          ? "Confirm swap (MEV-aware broadcast preferred)…"
          : "Confirm swap…",
      );
      const hash = await sendTransactionAsync({
        to: tx.to as Address,
        data: tx.data as Hex,
        value: tx.value ? BigInt(tx.value) : undefined,
      });
      setTxKind("trade");
      setTxSummary(`${tradeAmount} USDT`);
      setTxHash(hash);
      setHistory(
        pushHistory({
          side: tradeSide,
          ticker:
            tradeSide === "sell" && sellPosition && !opts?.pick
              ? sellPosition.ticker
              : tradeTicker,
          symbol: pick.candidate.symbol,
          amountLabel:
            tradeSide === "sell" && !opts?.pick
              ? sellPosition?.balance || "?"
              : `${tradeAmount} USDT`,
          txHash: hash,
          mode: pick.route.executionMode,
          vendor: pick.route.vendorName,
          status: "submitted",
        }),
      );
      const next = pushReceipt({
        ...receiptBase,
        simOk: json.simOk ?? null,
        txHash: hash,
        status: "submitted",
      });
      setReceipts(next);
      setActiveReceipt(next[0]);

      if (tradeSide === "buy") {
        const qty = Number(pick.outAmountHuman || 0);
        if (qty > 0 && Number(tradeAmount) > 0) {
          setPendingLot({
            side: "buy",
            ticker: tradeTicker,
            symbol: pick.candidate.symbol,
            contractAddress: pick.candidate.contractAddress,
            qty,
            costUsdt: Number(tradeAmount),
          });
        }
      } else if (tradeSide === "sell" && sellPosition) {
        setPendingLot({
          side: "sell",
          ticker: sellPosition.ticker,
          symbol: sellPosition.symbol,
          contractAddress: sellPosition.contractAddress,
          qty: Number(sellPosition.balance || 0),
          costUsdt: 0,
        });
      }

      setStatus(null);
      setSheetOpen(false);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Execution failed";
      setError(msg);
      setStatus(null);
      const next = pushReceipt({
        ...receiptBase,
        status: "failed",
        failReason: msg,
      });
      setReceipts(next);
      setActiveReceipt(next[0]);
      return false;
    } finally {
      setBuilding(false);
    }
  }

  async function oneClickBestRoute() {
    await resolve();
  }

  async function runAgent() {
    setLoading(true);
    setError(null);
    setAgentPending(false);
    try {
      const res = await fetch("/api/venue/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: agentPrompt, wallet: address }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || "Agent failed");
      setAgentOut(res);
      if (res.result?.type === "decision") {
        setDecision(res.result.decision);
        setSelectedQuoteId(
          res.result.decision.bestQuote?.route?.quoteId || null,
        );
        setQuoteAge(Date.now());
        chooseTab("trade");
        setSide("buy");
        if (res.intent?.ticker) setTicker(res.intent.ticker);
        if (res.intent?.amountUsdt) setAmount(String(res.intent.amountUsdt));
        setAgentPending(Boolean(res.result.decision.bestQuote));
        setAlerts(
          pushAlert({
            kind: "info",
            ticker: res.intent?.ticker,
            title: "Quote is ready",
            body: res.result.decision.reason,
          }),
        );
      }
      if (res.result?.type === "park") {
        setParkOptions(res.result.items || []);
        chooseTab("park");
      }
      if (res.autopilot?.tips) setAutopilot(res.autopilot.tips);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent failed");
    } finally {
      setLoading(false);
    }
  }

  type ParkCall = {
    to?: string;
    data?: string;
    value?: string;
    callDataType?: string;
  };

  const vaultAbi = [
    {
      name: "maxRedeem",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "owner", type: "address" }],
      outputs: [{ name: "shares", type: "uint256" }],
    },
    {
      name: "redeem",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "shares", type: "uint256" },
        { name: "receiver", type: "address" },
        { name: "owner", type: "address" },
      ],
      outputs: [{ name: "assets", type: "uint256" }],
    },
  ] as const;

  async function approvalAlreadyCovers(call: ParkCall, amountWei: bigint) {
    if (!publicClient || !address || !call.to || !call.data) return false;
    if ((call.callDataType || "").toUpperCase() !== "APPROVE") return false;
    try {
      const decoded = decodeFunctionData({
        abi: erc20Abi,
        data: call.data as Hex,
      });
      if (decoded.functionName !== "approve") return false;
      const current = await publicClient.readContract({
        address: call.to as Address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, decoded.args[0]],
      });
      return current >= amountWei;
    } catch {
      return false;
    }
  }

  async function broadcastCalls(calls: ParkCall[], amountWei?: bigint) {
    if (!publicClient) throw new Error("Wallet is not ready");
    const planned: ParkCall[] = [];
    for (const call of calls) {
      if (!call.to || !call.data) continue;
      if (amountWei != null && (await approvalAlreadyCovers(call, amountWei))) continue;
      planned.push(call);
    }
    const hashes: Hex[] = [];
    for (let i = 0; i < planned.length; i++) {
      const call = planned[i];
      const kind = (call.callDataType || "").toUpperCase();
      const step = `${i + 1} of ${planned.length}`;
      setStatus(
        kind === "APPROVE"
          ? `Confirm the USDT approval in MetaMask (${step}). The deposit is the next prompt.`
          : planned.length > 1
            ? `Confirm the deposit in MetaMask (${step}).`
            : "Confirm the deposit in MetaMask.",
      );
      const value =
        call.value && call.value !== "0x0" && call.value !== "0"
          ? BigInt(call.value)
          : undefined;
      const hash = await sendTransactionAsync({
        to: call.to as Address,
        data: call.data as Hex,
        value,
      });
      hashes.push(hash);
      await publicClient.waitForTransactionReceipt({ hash });
    }
    if (!hashes.length) throw new Error("Earn transaction was empty");
    return hashes;
  }

  async function depositPool(investmentId: string, amountLabel: string) {
    if (parkLock.current) return null;
    parkLock.current = true;
    setParkBusy(true);
    try {
      const res = await fetch("/api/venue/park", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          investmentId,
          amount: amountLabel,
          action: "deposit",
        }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || "Park failed");
      return await broadcastCalls(
        (res.data?.dataList || []) as ParkCall[],
        usdtAmountToWei(amountLabel),
      );
    } finally {
      parkLock.current = false;
      setParkBusy(false);
    }
  }

  function vaultFromDepositCalldata(data: string): Address | null {
    if (!data.startsWith("0xa46ea103") || data.length < 2 + 8 + 64 * 4) return null;
    const word = data.slice(2 + 8 + 64 * 3, 2 + 8 + 64 * 4);
    const vault = `0x${word.slice(24)}`;
    if (!/^0x[0-9a-f]{40}$/i.test(vault)) return null;
    if (/^0x0{40}$/i.test(vault)) return null;
    return vault as Address;
  }

  async function discoverVault(investmentId: string): Promise<Address | null> {
    for (const amount of ["0.01", "0.1", "1"]) {
      const preview = await fetch("/api/venue/park", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          investmentId,
          amount,
          action: "deposit",
        }),
      }).then((r) => r.json());
      const call = ((preview.data?.dataList || []) as ParkCall[]).find(
        (row) => row.callDataType === "DEPOSIT" && row.data,
      );
      if (!call?.data) continue;
      const decoded = vaultFromDepositCalldata(call.data);
      if (decoded) return decoded;
      if (call.to) return call.to as Address;
    }
    return null;
  }

  async function redeemPool(
    investmentId: string,
  ): Promise<{ hashes: Hex[]; settled: boolean }> {
    const res = await fetch("/api/venue/park", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        investmentId,
        action: "redeem",
        ratio: "1",
      }),
    }).then((r) => r.json());
    if (res.ok && res.data?.dataList?.length) {
      const hashes = await broadcastCalls(res.data.dataList as ParkCall[]);
      return { hashes, settled: true };
    }
    if (!publicClient || !address) {
      throw new Error("Connect a wallet to unpark.");
    }
    const vault = await discoverVault(investmentId);
    if (!vault) throw new Error("Nothing is parked in this pool.");

    let share: Address = vault;
    try {
      const found = await publicClient.readContract({
        address: vault,
        abi: [
          {
            name: "share",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "token", type: "address" }],
          },
        ] as const,
        functionName: "share",
      });
      if (found && found !== "0x0000000000000000000000000000000000000000") {
        share = found;
      }
    } catch {
      share = vault;
    }

    const held = await publicClient.readContract({
      address: share,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
    let claimable = 0n;
    try {
      claimable = await publicClient.readContract({
        address: vault,
        abi: vaultAbi,
        functionName: "maxRedeem",
        args: [address],
      });
    } catch {
      claimable = 0n;
    }
    if (claimable > 0n) {
      const data = encodeFunctionData({
        abi: vaultAbi,
        functionName: "redeem",
        args: [claimable, address, address],
      });
      const hash = await sendTransactionAsync({ to: vault, data });
      await publicClient.waitForTransactionReceipt({ hash });
      return { hashes: [hash], settled: true };
    }
    if (held <= 1n) throw new Error("Nothing is parked in this pool.");

    const hashes: Hex[] = [];
    const allowance = await publicClient.readContract({
      address: share,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address, vault],
    });
    if (allowance < held) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [vault, held],
      });
      const approveHash = await sendTransactionAsync({ to: share, data: approveData });
      hashes.push(approveHash);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }
    const instantData = encodeFunctionData({
      abi: [
        {
          name: "instantRedeem",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "shares", type: "uint256" },
            { name: "receiver", type: "address" },
            { name: "owner", type: "address" },
          ],
          outputs: [{ name: "assets", type: "uint256" }],
        },
      ] as const,
      functionName: "instantRedeem",
      args: [held, address, address],
    });
    let instantReady = false;
    try {
      await publicClient.call({ account: address, to: vault, data: instantData });
      instantReady = true;
    } catch {
      instantReady = false;
    }
    if (instantReady) {
      const hash = await sendTransactionAsync({ to: vault, data: instantData });
      hashes.push(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      return { hashes, settled: true };
    }
    const requestData = encodeFunctionData({
      abi: [
        {
          name: "requestRedeem",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "shares", type: "uint256" },
            { name: "controller", type: "address" },
            { name: "owner", type: "address" },
          ],
          outputs: [{ name: "requestId", type: "uint256" }],
        },
      ] as const,
      functionName: "requestRedeem",
      args: [held, address, address],
    });
    const hash = await sendTransactionAsync({ to: vault, data: requestData });
    hashes.push(hash);
    await publicClient.waitForTransactionReceipt({ hash });
    return { hashes, settled: false };
  }

  async function parkBestApy(amountOverride?: number) {
    if (!address) {
      setError("Connect wallet to park USDT");
      return;
    }
    let options = parkOptions;
    if (!options.length) {
      const park = await fetch("/api/venue/park").then((r) => r.json());
      if (!park.ok) {
        setError(park.error || "No park venues");
        return;
      }
      options = park.items || [];
      setParkOptions(options);
    }
    const apyOf = (row: { apyDisplay: string }) =>
      parseFloat(String(row.apyDisplay).replace(/[^\d.]/g, "")) || 0;
    const usdtPools = options.filter(
      (row) => (row.poolName || "").toUpperCase() === "USDT",
    );
    const best = [...usdtPools].sort((a, b) => apyOf(b) - apyOf(a))[0];
    if (!best) {
      setError("No USDT earn pool is available right now.");
      return;
    }
    let cashStr = (
      portfolio as { cash?: { usdt?: string } } | null
    )?.cash?.usdt;
    if (!cashStr) {
      const book = await fetch(
        `/api/venue/portfolio?wallet=${address}`,
      ).then((r) => r.json());
      if (book.ok) {
        setPortfolio(book.portfolio);
        cashStr = book.portfolio?.cash?.usdt;
      }
    }
    const cashN = Number(cashStr || 0);
    const requested = amountOverride ?? Number(amount);
    let parkAmt = requested > 0 ? requested : cashN;
    if (cashN > 0 && parkAmt > cashN) parkAmt = cashN;
    if (!(parkAmt > 0)) {
      setError("Enter a USDT amount, or hold USDT in this wallet.");
      return;
    }
    const parkAmtLabel = String(parkAmt);
    setError(null);
    setStatus(`Parking ${parkAmtLabel} USDT into ${best.protocolName} (${best.apyDisplay})…`);
    try {
      const hashes = await depositPool(best.investmentId, parkAmtLabel);
      if (!hashes) return;
      const txHash = hashes[hashes.length - 1];
      setTxKind("park");
      setUnparkPending(false);
      setTxSummary(`${parkAmtLabel} USDT · ${best.protocolName}`);
      setTxHash(txHash);
      setError(null);
      setStatus(null);
      setHistory(
        pushHistory({
          side: "park",
          ticker: "USDT",
          amountLabel: parkAmtLabel,
          status: "submitted",
          vendor: best.protocolName,
          txHash,
        }),
      );
      const next = pushReceipt({
        side: "park",
        ticker: "USDT",
        amountLabel: `${parkAmtLabel} USDT`,
        vendor: best.protocolName,
        mode: "Earn",
        sessionState: session?.state,
        simOk: true,
        status: "submitted",
        txHash,
        notes: [`APY ${best.apyDisplay}`, "One-tap park"],
      });
      setReceipts(next);
      setActiveReceipt(next[0]);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Park failed");
      setStatus(null);
    }
  }

  const openTrade = useCallback(
    (t: string) => {
      selectTicker(t);
      setSide("buy");
      setSellPosition(null);
      chooseTab("trade");
      setSheetOpen(false);
      router.replace(`/app?tab=trade&ticker=${encodeURIComponent(t)}`, {
        scroll: false,
      });
    },
    [selectTicker, router],
  );

  async function runStrategy(s: DeskStrategy) {
    if (!address) {
      setError("Connect a wallet to run this.");
      open();
      return;
    }
    setSide("buy");
    setSellPosition(null);
    setTicker(s.ticker);
    setAmount(String(s.amountUsdt));
    setError(null);
    setStatus(`Checking ${s.name}…`);
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        ticker: s.ticker,
        amount: String(s.amountUsdt),
        side: "buy",
        wallet: address,
      });
      const json = await fetch(`/api/venue/resolve?${qs}`).then((r) => r.json());
      if (!json.ok) throw new Error(json.error || "Resolve failed");
      setDecision(json.decision);
      setQuoteAge(Date.now());
      const best = json.decision.bestQuote as VenueDecision["bestQuote"];
      const spread = best?.candidate?.spreadBps;
      const within =
        Boolean(best?.route?.quoteId) &&
        (spread == null || spread <= s.maxSpreadBps);
      if (within && best) {
        setSelectedQuoteId(best.route.quoteId);
        chooseTab("trade");
        setStatus(
          `Signing ${best.candidate.symbol} · spread ${spread?.toFixed?.(1) ?? "?"} bps`,
        );
        await executeBest({
          pick: best,
          amountUsdt: s.amountUsdt,
          tickerName: s.ticker,
          sessionState: json.decision.session,
          skipStaleCheck: true,
        });
        return;
      }
      if (s.parkIfNoQuote) {
        chooseTab("park");
        setStatus(
          `Spread is ${spread?.toFixed?.(1) ?? "wider than the limit"}. Parking ${s.amountUsdt} USDT.`,
        );
        await parkBestApy(s.amountUsdt);
        return;
      }
      setError(
        `Spread ${spread?.toFixed?.(1) ?? "n/a"} bps is wider than ${s.maxSpreadBps}. Nothing was sent.`,
      );
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Strategy failed");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  async function armLimit(
    opts: {
      id: string;
      ticker: string;
      amountUsdt: number;
      maxSpreadBps: number;
    },
    quiet = false,
  ) {
    if (!address) {
      if (!quiet) {
        setError("Connect a wallet to arm this limit.");
        open();
      }
      return;
    }
    if (limitBusy.current || building) return;
    limitBusy.current = true;
    setSide("buy");
    setSellPosition(null);
    if (!quiet) {
      setError(null);
      setStatus(`Checking ${opts.ticker}…`);
      setLoading(true);
    }
    try {
      const qs = new URLSearchParams({
        ticker: opts.ticker,
        amount: String(opts.amountUsdt),
        side: "buy",
        wallet: address,
      });
      const json = await fetch(`/api/venue/resolve?${qs}`).then((r) => r.json());
      if (!json.ok) throw new Error(json.error || "Resolve failed");
      const best = json.decision.bestQuote as VenueDecision["bestQuote"];
      const spread = best?.candidate?.spreadBps;
      const cap = armedSpreadLimit(json.decision.session, opts.maxSpreadBps);
      const within =
        typeof spread === "number" &&
        spread <= cap &&
        Boolean(best?.route?.quoteId);
      if (!within || !best) {
        const wide =
          typeof spread === "number"
            ? `Spread is ${(spread / 100).toFixed(2)}%, wider than ${(cap / 100).toFixed(2)}%.`
            : "No live quote yet.";
        if (quiet) {
          setStatus(`${opts.ticker} stays armed. ${wide}`);
        } else {
          setStatus(null);
          setError(
            `${wide} The order stays on this page and signs when the quote tightens.`,
          );
        }
        return;
      }
      if (publicClient) {
        const usdtBal = await publicClient.readContract({
          address: "0x55d398326f99059fF775485246999027B3197955",
          abi: [
            {
              name: "balanceOf",
              type: "function",
              stateMutability: "view",
              inputs: [{ name: "account", type: "address" }],
              outputs: [{ name: "balance", type: "uint256" }],
            },
          ] as const,
          functionName: "balanceOf",
          args: [address],
        });
        if (usdtBal < usdtAmountToWei(opts.amountUsdt)) {
          const held = (Number(usdtBal) / 1e18).toFixed(2);
          const msg = `This wallet has ${held} USDT. Lower the amount and try again.`;
          if (quiet) setStatus(msg);
          else {
            setError(msg);
            setStatus(null);
          }
          return;
        }
      }
      setDecision(json.decision);
      setQuoteAge(Date.now());
      if (best.route.quoteId) setSelectedQuoteId(best.route.quoteId);
      setStatus(
        cap > opts.maxSpreadBps
          ? `Pre-market quote is ${(spread / 100).toFixed(2)}% from the reference. Signing inside the ${(cap / 100).toFixed(2)}% off-hours band.`
          : `Signing ${best.candidate.symbol} · ${(spread / 100).toFixed(2)}% from the reference`,
      );
      const filled = await executeBest({
        pick: best,
        amountUsdt: opts.amountUsdt,
        tickerName: opts.ticker,
        sessionState: json.decision.session,
        skipStaleCheck: true,
      });
      if (filled) {
        updateDeskOrder(opts.id, { status: "filled" });
        setStatus(`Limit filled · ${opts.ticker}`);
      }
    } catch (e) {
      if (!quiet) {
        setError(e instanceof Error ? e.message : "Limit failed");
        setStatus(null);
      }
    } finally {
      limitBusy.current = false;
      if (!quiet) setLoading(false);
    }
  }

  armLimitRef.current = armLimit;

function armedSpreadLimit(session: string | undefined, maxSpreadBps: number) {
  const offHours =
    session === "pre_market" ||
    session === "after_hours" ||
    session === "closed" ||
    session === "weekend";
  return offHours ? Math.max(maxSpreadBps, 15) : maxSpreadBps;
}

  useEffect(() => {
    if (tab !== "orders" || !address) return;
    const id = window.setInterval(() => {
      const next = loadDeskOrders().find(
        (o) =>
          o.status === "active" &&
          o.kind === "limit" &&
          o.limitSpreadBps != null,
      );
      if (!next || next.limitSpreadBps == null) return;
      void armLimitRef.current(
        {
          id: next.id,
          ticker: next.ticker,
          amountUsdt: next.amountUsdt,
          maxSpreadBps: next.limitSpreadBps,
        },
        true,
      );
    }, 20_000);
    return () => window.clearInterval(id);
  }, [tab, address]);

  const markQuoteStale = useCallback(() => setQuoteIsStale(true), []);

  const asset = tickerMeta(
    side === "sell" && sellPosition ? sellPosition.ticker : ticker,
  );
  const refPrice =
    selected?.candidate.referencePrice ??
    selected?.candidate.onChainPrice ??
    chartQuote?.last ??
    null;
  const watched = watch.some((w) => w.ticker === ticker);
  const outNum = Number(selected?.outAmountHuman);
  const payNum = Number(amount);
  const impliedPx =
    side === "buy" && outNum > 0 && payNum > 0 ? payNum / outNum : null;
  const quoteOff =
    impliedPx != null &&
    refPrice != null &&
    refPrice > 0 &&
    (impliedPx > refPrice * 4 || impliedPx < refPrice / 4);

  const tradePanel = (
    <section className="rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.06] lg:p-5 xl:p-6">
      <div className="flex rounded-[8px] bg-[var(--bg-muted)] p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={clsx(
              "flex-1 rounded-[8px] py-2.5 text-[15px] font-medium capitalize transition",
              side === s
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "text-[var(--ink-soft)]",
            )}
            onClick={() => {
              setSide(s);
              if (s === "buy") setSellPosition(null);
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {side === "buy" ? (
        <>
          <label className="mt-5 block text-xs font-medium text-[var(--ink-soft)]">
            Pay
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[var(--bg-muted)] px-4 py-3">
            <input
              className="w-full bg-transparent text-2xl font-semibold outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
            />
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2.5 text-sm font-semibold ring-1 ring-black/5">
              <span className="relative h-6 w-6 overflow-hidden rounded-full">
                <Image
                  src="/brand/logos/usdt.png"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="24px"
                />
              </span>
              USDT
            </span>
          </div>
          <label className="mt-4 block text-xs font-medium text-[var(--ink-soft)]">
            Receive
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[var(--bg-muted)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-2xl font-semibold tabular-nums">
                {selected?.outAmountHuman
                  ? Number(selected.outAmountHuman).toLocaleString(undefined, {
                      maximumFractionDigits:
                        Number(selected.outAmountHuman) >= 1 ? 4 : 6,
                    })
                  : "—"}
              </div>
              <div className="text-xs text-[var(--ink-soft)]">
                {selected?.candidate.symbol || asset.onSymbol}
                {impliedPx != null && (
                  <span className="text-[var(--ink)]">
                    {" "}
                    · ${impliedPx.toFixed(2)} each
                  </span>
                )}
              </div>
            </div>
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
              <Image
                src={asset.logo}
                alt=""
                fill
                className="object-cover"
                sizes="36px"
              />
            </span>
          </div>
          {quoteOff && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--danger)]">
              This quote is far from the ${refPrice?.toFixed(2)} market price.
              Refresh before you trade.
            </p>
          )}
        </>
      ) : (
        <>
          <label className="mt-5 block text-xs font-medium text-[var(--ink-soft)]">
            Pay
          </label>
          {sellPosition ? (
            <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[var(--bg-muted)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-2xl font-semibold tabular-nums">
                  {sellPosition.balance}
                </div>
                <div className="mono text-xs text-[var(--ink-soft)]">
                  {sellPosition.symbol}
                </div>
              </div>
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
                <Image
                  src={tickerMeta(sellPosition.ticker).logo}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="36px"
                />
              </span>
            </div>
          ) : (
            <div className="mt-2 rounded-2xl bg-[var(--bg-muted)] p-4 text-sm text-[var(--ink-soft)]">
              <EmptyState
                title={
                  !address
                    ? "Wallet not connected"
                    : portfolio
                      ? `No ${ticker} in this wallet`
                      : `Checking ${ticker}`
                }
                body={
                  !address
                    ? "Connect a wallet. If it holds this stock, the ticket fills itself."
                    : portfolio
                      ? `This wallet has no ${ticker} balance to sell.`
                      : "Reading this wallet for a matching stock."
                }
                actionLabel={address ? "Go to Portfolio" : "Connect wallet"}
                onAction={() => {
                  if (!address) {
                    open();
                    return;
                  }
                  chooseTab("portfolio");
                  setSheetOpen(false);
                }}
                className="!bg-transparent !px-0 !py-2"
              />
            </div>
          )}
          <label className="mt-4 block text-xs font-medium text-[var(--ink-soft)]">
            Receive
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[var(--bg-muted)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-2xl font-semibold tabular-nums">
                {selected?.outAmountHuman
                  ? Number(selected.outAmountHuman).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })
                  : "—"}
              </div>
              <div className="mono text-xs text-[var(--ink-soft)]">USDT</div>
            </div>
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
              <Image
                src="/brand/logos/usdt.png"
                alt=""
                fill
                className="object-cover"
                sizes="36px"
              />
            </span>
          </div>
        </>
      )}

      <details className="mt-4 rounded-2xl bg-[var(--bg-muted)] px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-[var(--ink)]">
          Slippage {slippage || "1.5"}%
          <span className="ml-2 font-normal text-[var(--ink-soft)]">
            Simulation, MEV, quote refresh
          </span>
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {["0.5", "1", "1.5", "3"].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSlippage(n)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium",
                slippage === n
                  ? "bg-black text-white"
                  : "bg-white text-[var(--ink-soft)] ring-1 ring-black/10",
              )}
            >
              {n}%
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--ink)]">
          <label className="flex items-center justify-between gap-3">
            Simulate before sign
            <input
              type="checkbox"
              checked={requireSim}
              onChange={(e) => setRequireSim(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            MEV protection
            <input
              type="checkbox"
              checked={mev}
              onChange={(e) => setMev(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            Refresh the quote
            <input
              type="checkbox"
              checked={pollEnabled}
              onChange={(e) => setPollEnabled(e.target.checked)}
            />
          </label>
        </div>
      </details>

      {agentPending && selected && (
        <div className="mt-4 rounded-2xl bg-[var(--signal-soft)]/60 p-3 text-sm">
          <div className="font-medium">Agent quote ready</div>
          <p className="mt-1 text-[var(--ink-soft)]">
            {selected.candidate.symbol} - {selected.route.executionMode} - ≈{" "}
            {selected.outAmountHuman}
          </p>
        </div>
      )}

      {selected && (
        <>
          <FeePreview
            className="mt-4"
            amountUsdt={Number(amount) || 0}
            route={selected.route}
            outHuman={selected.outAmountHuman}
          />
          <QuoteExpiry
            className="mt-2"
            quoteAge={quoteAge}
            onExpire={markQuoteStale}
          />
        </>
      )}

      {!selected ? (
        <button
          className="btn btn-primary mt-5 w-full"
          onClick={() => oneClickBestRoute()}
          disabled={loading || building || (side === "sell" && !sellPosition)}
        >
          {loading ? "Finding venue…" : "Find best venue"}
        </button>
      ) : isConnected ? (
        <button
          className="btn btn-primary mt-5 w-full"
          disabled={building || quoteIsStale || quoteOff}
          onClick={() => executeBest({ fromAgent: agentPending })}
        >
          {building
            ? "Working…"
            : quoteIsStale
              ? "Quote expired"
              : agentPending
                ? "Confirm & execute"
                : "Simulate & execute"}
        </button>
      ) : (
        <button
          className="btn btn-primary mt-5 w-full"
          onClick={() => open()}
        >
          Connect to execute
        </button>
      )}
      {selected && (
        <button
          className="btn btn-ghost mt-2 w-full"
          onClick={() => resolve()}
          disabled={loading || (side === "sell" && !sellPosition)}
        >
          {loading ? "Refreshing…" : quoteIsStale ? "Refresh expired quote" : "Refresh quote"}
        </button>
      )}
      {selected && pollEnabled && !quoteIsStale && (
        <p className="mt-2 text-center text-[11px] text-[var(--ink-soft)]">
          Updates on its own
        </p>
      )}
    </section>
  );

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f7f7] pb-24 lg:pb-0">
      <SiteHeader
        variant="solid"
        end={<AlertBell alerts={alerts} onChange={setAlerts} />}
      />
      <ReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
      <TradeSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        {tradePanel}
      </TradeSheet>

      <div className="pb-2">
        <div className="mx-auto max-w-[1320px] px-4 pt-24 sm:px-6">
          {tab !== "explore" && tab !== "portfolio" && (
            <div className="mt-4">
              <SessionAutopilot session={session} />
            </div>
          )}

          {error && (
            <ErrorBanner
              message={error}
              tone={
                /lower the (amount|park amount)|wider than/i.test(error)
                  ? "warn"
                  : "danger"
              }
              onDismiss={() => setError(null)}
              onRetry={
                /lower the (amount|park amount)/i.test(error)
                  ? undefined
                  : () => {
                      setError(null);
                      if (tab === "orders") {
                        const next = loadDeskOrders().find(
                          (o) =>
                            o.status === "active" &&
                            o.kind === "limit" &&
                            o.limitSpreadBps != null,
                        );
                        if (next?.limitSpreadBps != null) {
                          void armLimit({
                            id: next.id,
                            ticker: next.ticker,
                            amountUsdt: next.amountUsdt,
                            maxSpreadBps: next.limitSpreadBps,
                          });
                        }
                        return;
                      }
                      if (tab === "trade" || tab === "explore") resolve();
                      else if (tab === "portfolio") loadPortfolio();
                    }
              }
            />
          )}
          {status && !txHash && (
            <p className="mt-3 text-sm text-[var(--signal)]">{plainStatus(status)}</p>
          )}
          {(confirming || confirmed || txHash) && (
            <FillStatus
              className="mt-3"
              txHash={txHash}
              confirming={confirming}
              confirmed={confirmed}
              failed={failed}
              kind={txKind}
              summary={txSummary}
              claimLater={unparkPending}
            />
          )}

          <AnimatePresence mode="wait">
            {tab === "explore" && (
              <motion.div
                key="explore"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="mt-6"
              >
                <ExploreMarkets
                  portfolioTotal={
                    portfolio
                      ? Number(
                          (portfolio as { totalValueUsdt?: number })
                            .totalValueUsdt ??
                            (Number(
                              (portfolio as { cash?: { usdt?: string } }).cash
                                ?.usdt || 0,
                            ) +
                              Number(
                                (portfolio as { equityValueUsdt?: number })
                                  .equityValueUsdt || 0,
                              )),
                        )
                      : address
                        ? null
                        : 0
                  }
                  sessionLabel={
                    session
                      ? `${session.state.replace("_", " ")}`
                      : undefined
                  }
                  onSelect={openTrade}
                  onViewPortfolio={() => chooseTab("portfolio")}
                />
              </motion.div>
            )}

            {tab === "trade" && (
              <motion.div
                key="trade"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="mt-8"
              >
                <button
                  type="button"
                  className="mb-4 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  onClick={() => chooseTab("explore")}
                >
                  ← Markets
                </button>
                <CorporateActionBanner
                  className="mb-4"
                  ticker={
                    side === "sell" && sellPosition
                      ? sellPosition.ticker
                      : ticker
                  }
                  contract={
                    selected?.candidate.contractAddress ||
                    decision?.recommended?.contractAddress ||
                    null
                  }
                />
                <div className="mt-2 grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
                  <div className="min-w-0 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative min-w-0 flex-1" ref={assetPickerRef}>
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={assetPickerOpen}
                      onClick={() => setAssetPickerOpen((o) => !o)}
                      className="group -m-2 flex min-w-0 max-w-full items-center gap-4 rounded-2xl p-2 text-left transition hover:bg-[var(--bg-muted)]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/20"
                    >
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)] ring-1 ring-black/5">
                        <Image
                          src={asset.logo}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="display truncate text-[22px] sm:text-[26px]">
                            {asset.name}
                          </h2>
                          <span className="text-[15px] font-medium text-[var(--ink-soft)]">
                            {asset.onSymbol}
                          </span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={clsx(
                              "shrink-0 text-[var(--ink-soft)] transition group-hover:text-[var(--ink)]",
                              assetPickerOpen && "rotate-180",
                            )}
                            aria-hidden
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </div>
                    </button>

                    {assetPickerOpen && (
                      <div
                        role="listbox"
                        aria-label="Select asset"
                        className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(100vw-2.5rem,26rem)] overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.14)]"
                      >
                        <div className="border-b border-black/5 px-3 py-2.5">
                          <input
                            autoFocus
                            className="input !rounded-xl !py-2 text-sm"
                            placeholder="Search a name or ticker"
                            value={assetSearch}
                            onChange={(e) => setAssetSearch(e.target.value)}
                          />
                        </div>
                        <ul className="max-h-80 overflow-y-auto p-1.5">
                          {pickerRows.map((row) => {
                            const active =
                              ticker.toUpperCase() === row.ticker.toUpperCase() ||
                              ticker.toUpperCase() === row.symbol.toUpperCase();
                            return (
                              <li key={`${row.ticker}-${row.symbol}`}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  onClick={() => selectTicker(row.ticker)}
                                  className={clsx(
                                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                                    active
                                      ? "bg-[var(--bg-muted)]"
                                      : "hover:bg-[var(--bg-muted)]/70",
                                  )}
                                >
                                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)] ring-1 ring-black/5">
                                    <Image
                                      src={row.logo}
                                      alt=""
                                      fill
                                      className="object-contain"
                                      sizes="36px"
                                      unoptimized={row.logo.endsWith(".svg")}
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-[var(--ink)]">
                                      {row.name}
                                    </span>
                                    <span className="mono text-xs text-[var(--ink-soft)]">
                                      {row.symbol}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                          {pickerLoading && (
                            <li className="px-3 py-2 text-xs text-[var(--ink-soft)]">
                              Searching markets…
                            </li>
                          )}
                          {!pickerLoading && pickerRows.length === 0 && (
                            <li className="px-3 py-6 text-center text-sm text-[var(--ink-soft)]">
                              No markets match “{assetSearch}”
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={clsx(
                      "btn btn-sm shrink-0",
                      watched ? "btn-primary" : "btn-ghost",
                    )}
                    onClick={() => setWatch(toggleWatch(ticker))}
                  >
                    {watched ? "★ Watching" : "☆ Watch"}
                  </button>
                </div>

                {decision && (
                  <section>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                      <div className="display text-xl">Cross-wrapper compare</div>
                      <p className="text-sm text-[var(--ink-soft)]">
                        Pick a venue - ticket updates on the right
                      </p>
                    </div>
                    <WrapperCompare
                      quotes={decision.quotes}
                      selectedId={selectedQuoteId}
                      onSelect={setSelectedQuoteId}
                    />
                  </section>
                )}

                    <PriceChart
                      ticker={
                        side === "sell" && sellPosition
                          ? sellPosition.ticker
                          : ticker
                      }
                      contract={
                        selected?.candidate.contractAddress ||
                        decision?.recommended?.contractAddress ||
                        null
                      }
                      onQuote={setChartQuote}
                    />
                    {autopilot[0] && (
                      <p className="px-1 text-[13px] text-[var(--ink-soft)]">
                        {autopilot[0]}
                      </p>
                    )}

                    {meta && (
                      <div className="rounded-[22px] border border-black/[0.08] bg-white p-5 text-sm sm:p-6">
                        <div className="text-[17px] font-semibold">About</div>
                        <AboutCopy
                          text={String(
                            (meta.description as string | undefined) ||
                              meta.companyName ||
                              "",
                          )}
                        />
                        <dl className="mt-4 divide-y divide-black/[0.05] border-t border-black/[0.05]">
                          {meta.companyName ? (
                            <div className="flex items-center justify-between gap-4 py-3">
                              <dt className="text-[var(--ink-soft)]">
                                Underlying asset
                              </dt>
                              <dd className="text-right font-medium">
                                {String(meta.companyName)}
                              </dd>
                            </div>
                          ) : null}
                          {meta.ticker ? (
                            <div className="flex items-center justify-between gap-4 py-3">
                              <dt className="text-[var(--ink-soft)]">
                                Underlying ticker
                              </dt>
                              <dd className="font-medium">{String(meta.ticker)}</dd>
                            </div>
                          ) : null}
                          {meta.industry ? (
                            <div className="flex items-center justify-between gap-4 py-3">
                              <dt className="text-[var(--ink-soft)]">Industry</dt>
                              <dd className="font-medium">{String(meta.industry)}</dd>
                            </div>
                          ) : null}
                          {meta.dailyAttestation || meta.monthlyAttestation ? (
                            <div className="flex items-center justify-between gap-4 py-3">
                              <dt className="text-[var(--ink-soft)]">
                                Attestation reports
                              </dt>
                              <dd className="flex gap-3 font-medium">
                                {meta.dailyAttestation ? (
                                  <a
                                    href={String(meta.dailyAttestation)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                  >
                                    Daily
                                  </a>
                                ) : null}
                                {meta.monthlyAttestation ? (
                                  <a
                                    href={String(meta.monthlyAttestation)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                  >
                                    Monthly
                                  </a>
                                ) : null}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    )}

                    <AssetStats
                      ticker={
                        side === "sell" && sellPosition
                          ? sellPosition.ticker
                          : ticker
                      }
                      contract={
                        selected?.candidate.contractAddress ||
                        decision?.recommended?.contractAddress ||
                        null
                      }
                    />
                  </div>

                  <aside className="hidden min-w-0 lg:block">
                    <div className="space-y-4">
                      {tradePanel}

                      {decision && (
                        <div className="rounded-[24px] bg-[var(--bg-soft)] p-5 ring-1 ring-black/[0.04]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                              Recommendation
                            </div>
                            {selected && (
                              <span className="badge-live">Live route</span>
                            )}
                          </div>
                          <h3 className="display mt-2 text-2xl tracking-tight">
                            {selected
                              ? `${kindLabel(selected.candidate.kind)} - ${selected.candidate.symbol}`
                              : "No live route"}
                          </h3>
                          <p className="mt-2 text-sm leading-snug text-[var(--ink-soft)]">
                            {decision.reason}
                          </p>
                          {selected && (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-black/5">
                                {selected.route.executionMode}
                              </span>
                              {selected.route.vendorName && (
                                <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 ring-1 ring-black/5">
                                  <VendorName name={selected.route.vendorName} />
                                </span>
                              )}
                            </div>
                          )}
                          {decision.fallback === "park_defi" && (
                            <button
                              type="button"
                              className="btn btn-primary mt-3 w-full"
                              onClick={() => {
                                chooseTab("park");
                                void parkBestApy();
                              }}
                            >
                              Park idle USDT
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                  </aside>
                </div>

                <div className="mt-8">
                  <AlsoOwnSection
                    excludeTicker={ticker}
                    onSelect={(t) => setTicker(t)}
                    onExplore={() => chooseTab("explore")}
                  />
                </div>
              </motion.div>
            )}

            {tab === "portfolio" && (
              <motion.div
                key="portfolio"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <PortfolioView
                  address={address}
                  portfolio={
                    portfolio as {
                      cash?: { usdt?: string; bnb?: string };
                      positions?: Array<{
                        symbol: string;
                        ticker: string;
                        contractAddress: string;
                        balance: string;
                        balanceWei: string;
                        onChainPrice: number | null;
                        valueUsdt: number | null;
                        kind?: import("@/lib/venue/types").WrapperKind;
                      }>;
                      totalValueUsdt?: number;
                      equityValueUsdt?: number;
                    } | null
                  }
                  history={history}
                  receipts={receipts}
                  onOpenReceipt={setActiveReceipt}
                  costBasis={costBasis}
                  loading={loading}
                  onRefresh={loadPortfolio}
                  onPark={() => chooseTab("park")}
                  onConnect={() => open()}
                  onSell={(p) => {
                    setSellPosition({
                      symbol: p.symbol,
                      ticker: p.ticker,
                      contractAddress: p.contractAddress,
                      balanceWei: p.balanceWei,
                      balance: p.balance,
                    });
                    setSide("sell");
                    setTicker(p.ticker);
                    chooseTab("trade");
                    setSheetOpen(true);
                  }}
                  onTradeTicker={(t) => {
                    setTicker(t);
                    setSide("buy");
                    setSellPosition(null);
                    chooseTab("trade");
                  }}
                />
              </motion.div>
            )}

            {tab === "orders" && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              <TwapDesk
                defaultTicker={ticker}
                busy={loading || building}
                sessionState={session?.state}
                onActivateLimit={armLimit}
              />
            </motion.div>
          )}

          {tab === "strategies" && (
            <motion.div
              key="strategies"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              <SavedStrategies onRun={runStrategy} busy={loading} />
            </motion.div>
          )}

          {tab === "watch" && (
              <motion.div
                key="watch"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <h3 className="display text-[clamp(1.8rem,3vw,2.4rem)]">Watchlist</h3>
                <p className="mt-2 max-w-2xl text-sm text-[var(--ink-soft)]">
                  Prices from the live token chart. Alerts still fire when the
                  spread crosses your threshold.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {watch.map((w) => {
                    const m = tickerMeta(w.ticker);
                    const q = watchQuotes[w.ticker];
                    const up = q ? q.change >= 0 : true;
                    return (
                      <button
                        key={w.ticker}
                        type="button"
                        onClick={() => {
                          setTicker(w.ticker);
                          chooseTab("trade");
                        }}
                        className="flex min-h-[320px] flex-col rounded-[24px] border border-black/[0.08] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                            <Image
                              src={m.logo}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[17px] font-semibold leading-tight">
                              {m.onSymbol}
                            </div>
                            <div className="truncate text-[13px] text-[var(--ink-soft)]">
                              {m.name}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`mt-3 flex flex-1 flex-col rounded-[18px] px-4 pb-2 pt-4 ${
                            up ? "bg-[#e8f6ef]" : "bg-[#fdecee]"
                          }`}
                        >
                          <div className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                            {q ? `$${q.last.toFixed(2)}` : "—"}
                          </div>
                          <div
                            className={`mt-2 flex items-center gap-1.5 text-[14px] font-medium ${
                              up ? "text-[#0b7a45]" : "text-[#c62828]"
                            }`}
                          >
                            <svg
                              width="12"
                              height="10"
                              viewBox="0 0 12 10"
                              aria-hidden
                              className={up ? "" : "rotate-180"}
                            >
                              <path fill="currentColor" d="M6 0l6 10H0z" />
                            </svg>
                            {q
                              ? `${q.change >= 0 ? "" : "−"}$${Math.abs(q.change).toFixed(2)} (${Math.abs(q.changePct).toFixed(2)}%) 24H`
                              : "Loading"}
                          </div>
                          <div className="mt-auto pt-2">
                            <Sparkline
                              seed={w.ticker}
                              up={up}
                              height={120}
                              className="w-full"
                            />
                          </div>
                        </div>
                        <div className="mt-3 text-[12px] text-[var(--ink-soft)]">
                          Alert at {w.alertSpreadBps ?? 50} bps
                        </div>
                      </button>
                    );
                  })}
                  {watch.length === 0 && (
                    <EmptyState
                      className="col-span-2"
                      title="Watchlist empty"
                      body="Star a ticker on Trade to get spread and session alerts."
                      actionLabel="Browse markets"
                      onAction={() => chooseTab("explore")}
                    />
                  )}
                </div>
              </motion.div>
            )}

            {tab === "park" && (
              <motion.div
                key="park"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="display text-[clamp(1.8rem,3vw,2.4rem)]">
                      Park USDT
                    </h3>
                    <p className="mt-2 text-sm text-[var(--ink-soft)]">
                      When stock venues are quiet, earn on BNB Chain. The
                      highest rate is first. One click asks MetaMask for the
                      approval, then the deposit.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!address || !(Number(parkAmount) > 0) || parkBusy}
                    onClick={() => parkBestApy(Number(parkAmount))}
                  >
                    {parkBusy ? "Confirm in wallet" : "Park the highest rate"}
                  </button>
                </div>
                <div className="mt-5 max-w-sm">
                  <label className="text-xs font-medium text-[var(--ink-soft)]">
                    Amount to park
                    <span className="mt-1.5 flex h-11 items-center rounded-2xl bg-white px-3 ring-1 ring-black/[0.06]">
                      <input
                        className="w-full bg-transparent text-sm font-medium text-[var(--ink)] outline-none"
                        value={parkAmount}
                        onChange={(e) => setParkAmount(e.target.value)}
                        inputMode="decimal"
                        aria-label="USDT amount to park"
                      />
                      <span className="shrink-0 text-xs text-[var(--ink-soft)]">USDT</span>
                    </span>
                  </label>
                  <div className="mt-2 flex gap-2">
                    {["1", "5", "10"].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setParkAmount(n)}
                        className={
                          parkAmount === n
                            ? "rounded-full bg-[#111] px-3 py-1 text-xs font-medium text-white"
                            : "rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ink-soft)] ring-1 ring-black/10"
                        }
                      >
                        ${n}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ink-soft)] ring-1 ring-black/10"
                      onClick={() => {
                        const cash = Number(
                          (portfolio as { cash?: { usdt?: string } } | null)?.cash
                            ?.usdt || 0,
                        );
                        if (cash > 0) setParkAmount(String(Math.floor(cash * 100) / 100));
                      }}
                    >
                      Max
                    </button>
                  </div>
                </div>
                {!address && (
                  <button
                    type="button"
                    className="mt-4 text-sm font-medium text-[var(--ink-soft)] underline decoration-black/20 underline-offset-2"
                    onClick={() => open()}
                  >
                    Connect a wallet to park or unpark
                  </button>
                )}
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {parkOptions.map((p, i) => {
                    const pool =
                      p.poolName && p.poolName.length > 1 ? p.poolName : "";
                    return (
                      <li
                        key={p.investmentId}
                        className="flex flex-col rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                            {p.protocolLogo ? (
                              <Image
                                src={p.protocolLogo}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-contain p-1.5"
                              />
                            ) : null}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-semibold">
                              {p.protocolName}
                            </div>
                            <div className="truncate text-[13px] text-[var(--ink-soft)]">
                              {pool ? `${pool} · BNB Chain` : "BNB Chain"}
                              {i === 0 ? " · Highest" : ""}
                            </div>
                          </div>
                        </div>
                        <p className="mt-4 text-[32px] font-semibold leading-none tracking-[-0.03em] text-[var(--signal)] tabular-nums">
                          {p.apyDisplay || "—"}
                        </p>
                        {pool.toUpperCase() !== "USDT" && (
                          <p className="mt-2 text-sm text-[var(--ink-soft)]">
                            This pool takes {pool || "another token"}, so it
                            is not part of a USDT park.
                          </p>
                        )}
                        <p className="mt-2 text-sm text-[var(--ink-soft)]">
                          {p.tvlUsd != null
                            ? `${p.tvlUsd.toLocaleString(undefined, {
                                style: "currency",
                                currency: "USD",
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} in the pool`
                            : "Pool size unavailable"}
                        </p>
                        <div className="mt-5 flex gap-2">
                          <button
                            className="btn btn-primary flex-1"
                            disabled={
                              !address ||
                              parkBusy ||
                              !(Number(parkAmount) > 0) ||
                              pool.toUpperCase() !== "USDT"
                            }
                            onClick={async () => {
                              if (!address || parkBusy || !(Number(parkAmount) > 0)) return;
                              const cashN = Number(
                                (portfolio as { cash?: { usdt?: string } } | null)?.cash
                                  ?.usdt || 0,
                              );
                              if (cashN > 0 && Number(parkAmount) > cashN) {
                                setError(
                                  `This wallet has ${cashN.toFixed(2)} USDT. Lower the park amount.`,
                                );
                                return;
                              }
                              setError(null);
                              setStatus(`Parking ${parkAmount} USDT into ${p.protocolName}…`);
                              try {
                                const hashes = await depositPool(p.investmentId, parkAmount);
                                if (!hashes) return;
                                const txHash = hashes[hashes.length - 1];
                                setTxKind("park");
      setUnparkPending(false);
                                setTxSummary(`${parkAmount} USDT · ${p.protocolName}`);
                                setTxHash(txHash);
                                setStatus(null);
                                setHistory(
                                  pushHistory({
                                    side: "park",
                                    ticker: "USDT",
                                    amountLabel: parkAmount,
                                    status: "submitted",
                                    vendor: p.protocolName,
                                    txHash,
                                  }),
                                );
                                const next = pushReceipt({
                                  side: "park",
                                  ticker: "USDT",
                                  amountLabel: `${parkAmount} USDT`,
                                  vendor: p.protocolName,
                                  mode: "Earn",
                                  sessionState: session?.state,
                                  simOk: true,
                                  status: "submitted",
                                  txHash,
                                  notes: [`APY ${p.apyDisplay}`],
                                });
                                setReceipts(next);
                                setActiveReceipt(next[0]);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Park failed");
                                setStatus(null);
                              }
                            }}
                          >
                            {parkBusy ? "Confirm in wallet" : "Park"}
                          </button>
                          <button
                            className="btn btn-ghost flex-1"
                            disabled={!address || parkBusy || pool.toUpperCase() !== "USDT"}
                            onClick={async () => {
                              if (!address) return;
                              setError(null);
                              setTxHash(undefined);
                              setUnparkPending(false);
                              setStatus(`Unparking ${p.protocolName}…`);
                              try {
                                const { hashes, settled } = await redeemPool(p.investmentId);
                                setTxKind("unpark");
                                setTxSummary(p.protocolName);
                                setUnparkPending(!settled);
                                setTxHash(hashes[hashes.length - 1]);
                                setStatus(null);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Unpark failed");
                                setStatus(null);
                              }
                            }}
                          >
                            Unpark
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}

            {tab === "agent" && (
              <motion.div
                key="agent"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
                    <h3 className="display text-2xl">Ask the desk</h3>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      A buy opens the ticket. Park opens earn. A size ladder
                      stays here with the quotes.
                    </p>
                    <textarea
                      className="mt-5 min-h-[140px] w-full resize-y rounded-2xl bg-[var(--bg-muted)] px-4 py-3 text-[16px] leading-relaxed outline-none"
                      value={agentPrompt}
                      onChange={(e) => setAgentPrompt(e.target.value)}
                      placeholder="Buy $15 of NVDA at the best venue"
                    />
                    <button
                      type="button"
                      className="btn btn-primary mt-4 w-full"
                      onClick={runAgent}
                      disabled={loading || !agentPrompt.trim()}
                    >
                      {loading ? "Working…" : "Run"}
                    </button>
                    {agentPending && selected && (
                      <button
                        type="button"
                        className="btn btn-ghost mt-2 w-full"
                        disabled={building || !isConnected || quoteIsStale}
                        onClick={() => executeBest({ fromAgent: true })}
                      >
                        {quoteIsStale ? "Quote expired" : "Confirm and sign"}
                      </button>
                    )}
                  </section>
                  <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
                    <h3 className="display text-2xl">Try one</h3>
                    <ul className="mt-4 space-y-2">
                      {AGENT_EXAMPLES.map((ex) => {
                        const on = agentPrompt === ex.prompt;
                        return (
                          <li key={ex.prompt}>
                            <button
                              type="button"
                              onClick={() => setAgentPrompt(ex.prompt)}
                              className={clsx(
                                "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left",
                                on
                                  ? "bg-[var(--ink)] text-white"
                                  : "bg-[var(--bg-muted)] hover:bg-black/[0.04]",
                              )}
                            >
                              <span>
                                <span className="block font-semibold">
                                  {ex.title}
                                </span>
                                <span
                                  className={clsx(
                                    "mt-0.5 block text-sm",
                                    on ? "text-white/70" : "text-[var(--ink-soft)]",
                                  )}
                                >
                                  {ex.body}
                                </span>
                              </span>
                              <span
                                className={clsx(
                                  "shrink-0 text-xs font-medium",
                                  on ? "text-white/80" : "text-[var(--ink-soft)]",
                                )}
                              >
                                Use
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </div>
                {agentOut != null && <AgentAnswer data={agentOut} />}
              </motion.div>
            )}

            {tab === "tape" && (
              <motion.div
                key="tape"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <TapeSellPanel />
              </motion.div>
            )}
          </AnimatePresence>

          {tab === "trade" && !sheetOpen && (
            <div className="sticky-cta mt-8 lg:hidden">
              <div className="flex gap-3 rounded-[16px] border border-black/5 bg-white/95 p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.1)] backdrop-blur">
                <button
                  className="btn btn-primary flex-1"
                  onClick={() => setSheetOpen(true)}
                >
                  {selected ? "Review & execute" : "Open trade ticket"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}

const AGENT_EXAMPLES = [
  {
    title: "Buy NVIDIA",
    body: "Best wrapper for $15",
    prompt: "buy $15 NVDA best venue",
  },
  {
    title: "Size Tesla",
    body: "Quotes at $15, $50, and $200",
    prompt: "ladder TSLA",
  },
  {
    title: "Park USDT",
    body: "Highest earn rate on BNB Chain",
    prompt: "park usdt",
  },
  {
    title: "Portfolio",
    body: "Cash and tokenized stocks in this wallet",
    prompt: "portfolio",
  },
  {
    title: "Sell NVDAB",
    body: "Half of the bStock position",
    prompt: "sell half NVDAB",
  },
];

function AgentAnswer({ data }: { data: unknown }) {
  const row = (data || {}) as {
    intent?: { action?: string; ticker?: string; amountUsdt?: number };
    autopilot?: { tips?: string[] };
    result?: {
      type?: string;
      error?: string;
      hint?: string;
      ladder?: {
        rows?: Array<{
          amountUsdt: number;
          ok: boolean;
          symbol?: string;
          vendor?: string;
          outHuman?: string;
          error?: string;
        }>;
      };
      portfolio?: { totalValueUsdt?: number };
      candidate?: { symbol?: string };
      fraction?: number;
    } | null;
  };
  const result = row.result;
  const tips = row.autopilot?.tips || [];
  return (
    <section className="mt-6 rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
      <h3 className="display text-2xl">Answer</h3>
      {!result && (
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          That didn’t match a buy, sell, park, portfolio, or size ladder.
        </p>
      )}
      {result?.type === "ladder" && (
        <ul className="mt-4 divide-y divide-black/[0.05]">
          {(result.ladder?.rows || []).map((r) => (
            <li
              key={r.amountUsdt}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <span className="font-semibold">${r.amountUsdt}</span>
              <span className="text-[var(--ink-soft)]">
                {r.ok
                  ? `${r.symbol || "Wrapper"} · ${r.outHuman || "—"} via ${r.vendor || "venue"}`
                  : r.error || "No quote"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result?.type === "portfolio" && (
        <p className="mt-2 text-sm">
          {result.error ||
            `Portfolio loaded${
              result.portfolio?.totalValueUsdt != null
                ? ` · $${Number(result.portfolio.totalValueUsdt).toFixed(2)}`
                : ""
            }. Open Portfolio for the full book.`}
        </p>
      )}
      {result?.type === "sell" && (
        <p className="mt-2 text-sm">
          {result.error ||
            `${result.candidate?.symbol || "Wrapper"} · sell ${Math.round((result.fraction || 1) * 100)}%. ${result.hint || "Open the trade ticket to sign."}`}
        </p>
      )}
      {result && result.type !== "ladder" && result.type !== "portfolio" && result.type !== "sell" && (
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          {result.type === "decision"
            ? "Quote is on the trade ticket. Confirm there before you sign."
            : result.type === "park"
              ? "Earn venues are on Park."
              : "Done."}
        </p>
      )}
      {tips.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-[var(--ink-soft)]">
          {tips.slice(0, 3).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function plainStatus(text: string) {
  return text
    .replace(/pre_market/gi, "pre-market")
    .replace(/after_hours/gi, "after hours")
    .replace(/Park sim OK/g, "Park preview ready")
    .replace(/Strategy OK/g, "Strategy ready")
    .replace(/(\d+(?:\.\d+)?) bps/gi, (_, n: string) => `${(Number(n) / 100).toFixed(2)}%`);
}

function fmt(n: number | null | undefined) {
  if (n == null) return "-";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
