"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { Sparkline } from "@/components/Sparkline";
import { loadChart } from "@/lib/venue/chartQuote";
import { CORE_TICKERS, tickerMeta } from "@/lib/venue/tickers";

type QuoteRow = {
  ticker: string;
  last: number | null;
  change: number;
  changePct: number;
  volume: number;
  open: boolean;
  markets: number;
};

type Filter =
  | "all"
  | "247"
  | "etf"
  | "tech"
  | "consumer"
  | "financials"
  | "large"
  | "growth"
  | "value";

type SortKey = "popular" | "volume" | "change" | "name";
type ViewMode = "list" | "grid";
type ListTab = "stocks" | "wrappers";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All assets" },
  { id: "247", label: "24/7 Available" },
  { id: "etf", label: "ETF" },
  { id: "tech", label: "Technology" },
  { id: "consumer", label: "Consumer" },
  { id: "financials", label: "Financials" },
  { id: "large", label: "Large Cap" },
  { id: "growth", label: "Growth" },
  { id: "value", label: "Value" },
];

const TECH = new Set(["NVDA", "AAPL", "MSFT", "GOOGL", "META", "AMD", "NFLX"]);
const CONSUMER = new Set(["AMZN", "TSLA", "NFLX", "AAPL", "META"]);
const ETF = new Set(["SPY"]);
const FINANCIALS = new Set(["SPY"]);
const LARGE = new Set(["NVDA", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "TSLA"]);
const GROWTH = new Set(["NVDA", "TSLA", "META", "NFLX", "AMD", "GOOGL"]);
const VALUE = new Set(["AAPL", "MSFT", "AMZN", "SPY"]);
const ALWAYS_247 = new Set(["SPY", "NVDA", "TSLA", "META"]);

const VENUE_MARKS = [
  "/brand/partners/p4.svg",
  "/brand/partners/p2.svg",
  "/brand/partners/p10.svg",
  "/brand/logos/bnb.png",
];

function emptyQuote(ticker: string): QuoteRow {
  return {
    ticker,
    last: null,
    change: 0,
    changePct: 0,
    volume: 0,
    open: true,
    markets: 0,
  };
}

function fmtPrice(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtVolume(n: number) {
  if (!n) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

function moveLabel(row: QuoteRow) {
  if (row.last == null) return "—";
  const up = row.changePct >= 0;
  return `${up ? "▲" : "▼"} ${Math.abs(row.changePct).toFixed(2)}%`;
}

function matchesFilter(ticker: string, f: Filter) {
  if (f === "all") return true;
  if (f === "247") return ALWAYS_247.has(ticker);
  if (f === "tech") return TECH.has(ticker);
  if (f === "consumer") return CONSUMER.has(ticker);
  if (f === "etf") return ETF.has(ticker);
  if (f === "financials") return FINANCIALS.has(ticker);
  if (f === "large") return LARGE.has(ticker);
  if (f === "growth") return GROWTH.has(ticker);
  if (f === "value") return VALUE.has(ticker);
  return true;
}

export function ExploreMarkets({
  portfolioTotal,
  sessionLabel,
  onSelect,
  onViewPortfolio,
}: {
  portfolioTotal?: number | null;
  sessionLabel?: string;
  onSelect: (ticker: string) => void;
  onViewPortfolio?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("popular");
  const [view, setView] = useState<ViewMode>("list");
  const [listTab, setListTab] = useState<ListTab>("stocks");
  const [rows, setRows] = useState<QuoteRow[]>(() =>
    CORE_TICKERS.map(emptyQuote),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: QuoteRow[] = [];
      for (const ticker of CORE_TICKERS) {
        const fallback = emptyQuote(ticker);
        try {
          const d = await loadChart(ticker, "1D");
          if (!d.ok || d.last == null) {
            next.push(fallback);
            continue;
          }
          const volume = (d.candles || []).reduce((sum, c) => sum + (c.v || 0), 0);
          next.push({
            ...fallback,
            last: Number(d.last),
            change: Number(d.change ?? 0),
            changePct: Number(d.changePct ?? 0),
            volume,
            markets: 1,
          });
        } catch {
          next.push(fallback);
        }
      }
      if (!cancelled) setRows(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byTicker = useMemo(() => {
    const m = new Map<string, QuoteRow>();
    for (const r of rows) m.set(r.ticker, r);
    return m;
  }, [rows]);

  const ribbon = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
        .slice(0, 6),
    [rows],
  );

  const gainers = useMemo(
    () => [...rows].sort((a, b) => b.changePct - a.changePct).slice(0, 3),
    [rows],
  );
  const trending = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
        .slice(0, 3),
    [rows],
  );
  const newly = useMemo(() => [...rows].slice(-3).reverse(), [rows]);

  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows
      .filter((r) => matchesFilter(r.ticker, filter))
      .filter((r) => {
        if (!q) return true;
        const m = tickerMeta(r.ticker);
        return (
          r.ticker.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.onSymbol.toLowerCase().includes(q)
        );
      });

    if (sort === "volume") list = [...list].sort((a, b) => b.volume - a.volume);
    else if (sort === "change")
      list = [...list].sort((a, b) => b.changePct - a.changePct);
    else if (sort === "name")
      list = [...list].sort((a, b) => a.ticker.localeCompare(b.ticker));
    else
      list = [...list].sort(
        (a, b) => Math.abs(b.changePct) * b.volume - Math.abs(a.changePct) * a.volume,
      );

    return list;
  }, [rows, filter, query, sort]);

  const total = portfolioTotal ?? 0;
  const nvda = byTicker.get("NVDA");
  const d24 = nvda?.last != null ? nvda.changePct : null;
  const marketStatus = sessionLabel
    ? `Market Open (${sessionLabel})`
    : "Market Open (Pre-Market)";

  return (
    <div className="space-y-3">
      {/* Portfolio strip */}
      <section className="rounded-[18px] border border-black/[0.08] bg-white px-5 py-3.5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="text-[12px] text-[var(--ink-soft)]">
              Total Portfolio Value
            </div>
            <div className="mt-0.5 flex flex-wrap items-end gap-3">
              <div className="display text-[32px] leading-none tracking-[-0.03em]">
                {fmtPrice(total)}
              </div>
              <div className="mb-1 flex flex-wrap gap-2">
                {d24 != null && <PeriodPill label="24H" pct={d24} />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:justify-end">
            {d24 != null && (
              <Sparkline
                seed={`port-${Math.round(total)}`}
                up={d24 >= 0}
                height={36}
                className="hidden w-32 md:block"
              />
            )}
            {onViewPortfolio && (
              <button
                type="button"
                className="shrink-0 text-sm font-medium text-[var(--ink)] hover:underline"
                onClick={onViewPortfolio}
              >
                View Portfolio →
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Dark hero */}
      <section className="relative overflow-hidden rounded-[18px] bg-[#111] px-6 py-5 text-white sm:px-7">
        <div className="relative z-10 grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-center md:gap-8">
          <div className="min-w-0">
            <h2 className="display text-[28px] leading-[1.05] tracking-[-0.03em] sm:text-[32px]">
              One ticker.
              <br />
              Best venue.
            </h2>
            <p className="mt-2 max-w-md text-[13px] leading-snug text-white/65">
              One name, quoted across the wrappers on BNB Chain. OpenVenue uses
              the one that is actually open.
            </p>
            <button
              type="button"
              className="mt-4 rounded-full border border-white/25 px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-white/10"
              onClick={() => onSelect("NVDA")}
            >
              Learn More
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { t: "NVDAB", d: "bStocks - RFQ / AMM" },
              { t: "NVDAon", d: "Ondo - attestation-backed" },
              { t: "NVDAx", d: "xStocks - 24/7 AMM" },
            ].map((card, i) => (
              <div
                key={card.t}
                className={clsx(
                  "min-w-0 rounded-xl bg-white/5 px-3 py-3 ring-1 ring-white/10 backdrop-blur",
                  i === 1 && "bg-white/10 ring-white/20",
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm font-semibold">
                  {card.t.slice(0, 1)}
                </div>
                <div className="mt-2 truncate text-[13px] font-semibold">
                  {card.t}
                </div>
                <div className="mt-0.5 text-[10px] leading-snug text-white/55">
                  {card.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gainers / Trending / New */}
      <div className="grid gap-3 lg:grid-cols-3">
        <MiniList
          title="Top Gainers (24H)"
          rows={gainers}
          mode="pct"
          onSelect={onSelect}
        />
        <MiniList
          title="Trending (24H)"
          rows={trending}
          mode="vol"
          onSelect={onSelect}
        />
        <MiniList
          title="Newly Added"
          rows={newly}
          mode="vol"
          onSelect={onSelect}
        />
      </div>

      {/* Featured ribbon + Stocks & ETFs table */}
      <section className="overflow-hidden rounded-[18px] border border-black/[0.08] bg-white">
        {/* Top featured strip */}
        <div className="flex gap-2 overflow-x-auto border-b border-black/[0.06] px-3 py-2 sm:px-4">
          {ribbon.map((r) => {
            const m = tickerMeta(r.ticker);
            const up = r.changePct >= 0;
            return (
              <button
                key={r.ticker}
                type="button"
                onClick={() => onSelect(r.ticker)}
                className="flex min-w-[168px] shrink-0 items-center gap-2 rounded-xl bg-[var(--bg-muted)]/70 px-2.5 py-1.5 text-left transition hover:bg-[var(--bg-muted)]"
              >
                <span className="relative h-7 w-7 overflow-hidden rounded-full bg-white">
                  <Image
                    src={m.logo}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {m.onSymbol}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="tabular-nums">{fmtPrice(r.last)}</span>
                    <span
                      className={clsx(
                        "tabular-nums",
                        r.last == null
                          ? "text-[var(--ink-soft)]"
                          : up
                            ? "text-[var(--signal)]"
                            : "text-[var(--danger)]",
                      )}
                    >
                      {moveLabel(r)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/[0.06]">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setListTab("stocks")}
                className={clsx(
                  "border-b-2 px-1 pb-2 text-[15px] font-semibold transition",
                  listTab === "stocks"
                    ? "border-[var(--ink)] text-[var(--ink)]"
                    : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]",
                )}
              >
                Stocks &amp; ETFs{" "}
                <span className="ml-1 font-medium text-[var(--ink-soft)]">
                  {CORE_TICKERS.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setListTab("wrappers")}
                className={clsx(
                  "border-b-2 px-1 pb-2 text-[15px] font-semibold transition",
                  listTab === "wrappers"
                    ? "border-[var(--ink)] text-[var(--ink)]"
                    : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]",
                )}
              >
                Wrappers{" "}
                <span className="ml-1 font-medium text-[var(--ink-soft)]">
                  3
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[var(--signal-soft)] px-3 py-1.5 text-xs font-medium text-[var(--signal)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
              {marketStatus}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  filter === f.id
                    ? "bg-[#e8e8e8] text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--bg-muted)]",
                )}
              >
                {f.label}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-1.5">
              {searchOpen ? (
                <input
                  autoFocus
                  className="input !h-8 !w-40 !rounded-full !py-1 text-xs"
                  placeholder="Search assets"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => {
                    if (!query) setSearchOpen(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  aria-label="Search"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--bg-muted)]"
                  onClick={() => setSearchOpen(true)}
                >
                  <SearchIcon />
                </button>
              )}
              <button
                type="button"
                aria-label="List view"
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  view === "list"
                    ? "bg-[var(--bg-muted)] text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--bg-muted)]",
                )}
                onClick={() => setView("list")}
              >
                <ListIcon />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  view === "grid"
                    ? "bg-[var(--bg-muted)] text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--bg-muted)]",
                )}
                onClick={() => setView("grid")}
              >
                <GridIcon />
              </button>
              <select
                className="h-8 rounded-full border-0 bg-[var(--bg-muted)] px-3 text-xs font-medium outline-none"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="popular">Most Popular</option>
                <option value="volume">Highest Volume</option>
                <option value="change">Top Gainers</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
          </div>

          {listTab === "wrappers" ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                {
                  id: "bstock",
                  title: "bStocks",
                  body: "Binance-native wrappers - strong RFQ during US cash hours.",
                },
                {
                  id: "ondo",
                  title: "Ondo",
                  body: "Attestation-backed stock tokens with Ondo collateral reports.",
                },
                {
                  id: "xstock",
                  title: "xStocks",
                  body: "24/7 AMM-friendly wrappers for weekends and overnight.",
                },
              ].map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onSelect("NVDA")}
                  className="rounded-[20px] border border-black/[0.06] bg-[var(--bg-muted)]/40 p-5 text-left transition hover:bg-[var(--bg-muted)]"
                >
                  <div className="display text-xl">{w.title}</div>
                  <p className="mt-2 text-sm text-[var(--ink-soft)]">{w.body}</p>
                </button>
              ))}
            </div>
          ) : view === "grid" ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tableRows.map((r) => {
                const m = tickerMeta(r.ticker);
                const up = r.changePct >= 0;
                return (
                  <button
                    key={r.ticker}
                    type="button"
                    onClick={() => onSelect(r.ticker)}
                    className="rounded-[20px] border border-black/[0.06] p-4 text-left transition hover:bg-[var(--bg-muted)]/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <Image
                          src={m.logo}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      </span>
                      <div>
                        <div className="font-semibold">{m.onSymbol}</div>
                        <div className="text-xs text-[var(--ink-soft)]">
                          {m.name}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <div className="text-lg font-semibold tabular-nums">
                          {fmtPrice(r.last)}
                        </div>
                        <div
                          className={clsx(
                            "text-xs tabular-nums",
                            r.last == null
                              ? "text-[var(--ink-soft)]"
                              : up
                                ? "text-[var(--signal)]"
                                : "text-[var(--danger)]",
                          )}
                        >
                          {moveLabel(r)}
                        </div>
                      </div>
                      {r.last != null && (
                        <Sparkline
                          seed={r.ticker}
                          up={up}
                          height={40}
                          className="w-24"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
            <ul className="mt-2 divide-y divide-black/[0.06] md:hidden">
              {tableRows.map((r) => {
                const m = tickerMeta(r.ticker);
                const up = r.changePct >= 0;
                return (
                  <li key={r.ticker}>
                    <button
                      type="button"
                      onClick={() => onSelect(r.ticker)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <Image src={m.logo} alt="" fill className="object-cover" sizes="40px" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{m.name}</span>
                        <span className="block text-xs text-[var(--ink-soft)]">{m.onSymbol}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-semibold tabular-nums">{fmtPrice(r.last)}</span>
                        <span
                          className={clsx(
                            "block text-xs tabular-nums",
                            r.last == null
                              ? "text-[var(--ink-soft)]"
                              : up
                                ? "text-[var(--signal)]"
                                : "text-[var(--danger)]",
                          )}
                        >
                          {moveLabel(r)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-black/5 text-[12px] text-[var(--ink-soft)]">
                    <th className="pb-3 pr-2 font-medium">#</th>
                    <th className="pb-3 pr-4 font-medium">Asset Name</th>
                    <th className="pb-3 pr-4 font-medium">Price</th>
                    <th className="pb-3 pr-4 font-medium">24h ($)</th>
                    <th className="pb-3 pr-4 font-medium">24h (%)</th>
                    <th className="pb-3 pr-4 font-medium">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => setSort("volume")}
                      >
                        24H Volume
                        <span className="text-[10px]">▼</span>
                      </button>
                    </th>
                    <th className="pb-3 pr-4 font-medium">Asset Status</th>
                    <th className="pb-3 font-medium">24h Chart</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => {
                    const m = tickerMeta(r.ticker);
                    const up = r.changePct >= 0;
                    const flat = Math.abs(r.changePct) < 0.005;
                    return (
                      <tr
                        key={r.ticker}
                        className="cursor-pointer border-b border-black/[0.04] last:border-0 hover:bg-[#f5f5f5]"
                        onClick={() => onSelect(r.ticker)}
                      >
                        <td className="py-2.5 pr-2 text-[var(--ink-soft)]">
                          {i + 1}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                              <Image
                                src={m.logo}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="36px"
                              />
                            </span>
                            <div>
                              <div className="font-semibold">{m.onSymbol}</div>
                              <div className="text-xs text-[var(--ink-soft)]">
                                {m.name}
                              </div>
                              {r.markets > 1 && (
                                <div className="mt-1 flex items-center gap-1.5">
                                  <div className="flex -space-x-1">
                                    {VENUE_MARKS.slice(0, r.markets + 1).map(
                                      (src) => (
                                        <span
                                          key={src}
                                          className="relative h-3.5 w-3.5 overflow-hidden rounded-full bg-white ring-1 ring-black/10"
                                        >
                                          <Image
                                            src={src}
                                            alt=""
                                            fill
                                            className="object-contain p-px"
                                            sizes="14px"
                                          />
                                        </span>
                                      ),
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[var(--ink-soft)]">
                                    {r.markets + 1} Markets Available
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 font-semibold tabular-nums">
                          {fmtPrice(r.last)}
                        </td>
                        <td
                          className={clsx(
                            "py-2.5 pr-4 tabular-nums",
                            r.last == null || flat
                              ? "text-[var(--ink-soft)]"
                              : up
                                ? "text-[var(--signal)]"
                                : "text-[var(--danger)]",
                          )}
                        >
                          {r.last == null
                            ? "—"
                            : `${flat ? "" : up ? "▲ " : "▼ "}${fmtPrice(Math.abs(r.change))}`}
                        </td>
                        <td
                          className={clsx(
                            "py-2.5 pr-4 tabular-nums",
                            r.last == null || flat
                              ? "text-[var(--ink-soft)]"
                              : up
                                ? "text-[var(--signal)]"
                                : "text-[var(--danger)]",
                          )}
                        >
                          {moveLabel(r)}
                        </td>
                        <td className="py-2.5 pr-4 tabular-nums text-[var(--ink)]">
                          {fmtVolume(r.volume)}
                        </td>
                        <td className="py-2.5 pr-4">
                          {r.last == null ? (
                            <span className="text-[var(--ink-soft)]">—</span>
                          ) : r.open ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f6ef] px-2.5 py-1 text-xs font-medium text-[var(--signal)]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
                              Asset Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#efefef] px-2.5 py-1 text-xs font-medium text-[var(--ink-soft)]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#9a9a9a]" />
                              Asset Paused
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">
                          {r.last != null && (
                            <Sparkline
                              seed={r.ticker}
                              up={up}
                              height={28}
                              className="w-24"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-sm text-[var(--ink-soft)]"
                      >
                        No assets match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function PeriodPill({ label, pct }: { label: string; pct: number }) {
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-[11px] font-medium">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className={up ? "text-[var(--signal)]" : "text-[var(--danger)]"}>
        {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
      </span>
    </span>
  );
}

function MiniList({
  title,
  rows,
  mode,
  onSelect,
}: {
  title: string;
  rows: QuoteRow[];
  mode: "pct" | "vol";
  onSelect: (t: string) => void;
}) {
  return (
    <div className="rounded-[18px] border border-black/[0.08] bg-white px-3.5 py-3">
      <div className="text-[13px] font-semibold">{title}</div>
      <ul className="mt-1.5">
        {rows.map((r) => {
          const m = tickerMeta(r.ticker);
          const up = r.changePct >= 0;
          return (
            <li key={r.ticker}>
              <button
                type="button"
                onClick={() => onSelect(r.ticker)}
                className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left transition hover:bg-[var(--bg-muted)]/70"
              >
                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <Image
                    src={m.logo}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold leading-tight">
                    {m.onSymbol}
                  </div>
                  <div className="truncate text-[11px] text-[var(--ink-soft)]">
                    {m.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold tabular-nums">
                    {fmtPrice(r.last)}
                  </div>
                  {mode === "pct" ? (
                    <div
                      className={clsx(
                        "text-xs tabular-nums",
                        r.last == null
                          ? "text-[var(--ink-soft)]"
                          : up
                            ? "text-[var(--signal)]"
                            : "text-[var(--danger)]",
                      )}
                    >
                      {moveLabel(r)}
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--ink-soft)] tabular-nums">
                      Vol {fmtVolume(r.volume)}
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="6" width="16" height="2" rx="1" />
      <rect x="4" y="11" width="16" height="2" rx="1" />
      <rect x="4" y="16" width="16" height="2" rx="1" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}
