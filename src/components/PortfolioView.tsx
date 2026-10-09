"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { Sparkline } from "@/components/Sparkline";
import { CORE_TICKERS, tickerMeta } from "@/lib/venue/tickers";
import type { HistoryItem } from "@/lib/venue/local";
import type { CostBasisLot, TradeReceipt } from "@/lib/venue/receipts";
import type { WrapperKind } from "@/lib/venue/types";

export type PortfolioPosition = {
  symbol: string;
  ticker: string;
  contractAddress: string;
  balance: string;
  balanceWei: string;
  onChainPrice: number | null;
  valueUsdt: number | null;
  kind?: WrapperKind;
  platform?: string;
};

export type PortfolioData = {
  cash?: { usdt?: string; bnb?: string };
  positions?: PortfolioPosition[];
  totalValueUsdt?: number;
  equityValueUsdt?: number;
};

type Range = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";
type AllocTab = "all" | "cash" | "equity" | "crypto";

const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];
const BNB_USD_EST = 620; // display estimate for allocation / crypto row

function fmtUsd(n: number, digits = 2) {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function assetClass(kind?: WrapperKind) {
  if (!kind) return "Crypto";
  if (kind === "ondo") return "Ondo Stocks";
  if (kind === "bstock") return "bStocks";
  if (kind === "xstock") return "xStocks";
  return "RWA";
}

function classColor(label: string) {
  if (label === "Cash") return "#f59e0b";
  if (label === "Crypto") return "#8b5cf6";
  if (label.includes("Ondo")) return "#007a4b";
  if (label.includes("bStock")) return "#2563eb";
  return "#0d9488";
}

type ActivityRow = {
  id: string;
  at: string;
  side: HistoryItem["side"];
  ticker: string;
  symbol?: string;
  amountLabel: string;
  mode?: string;
  vendor?: string;
  status: HistoryItem["status"];
  failReason?: string;
};

type ActivityFilter = "all" | "trades" | "failed";

function activityTitle(row: ActivityRow) {
  const name = row.symbol || row.ticker;
  if (row.side === "buy") return `Bought ${name}`;
  if (row.side === "sell") return `Sold ${name}`;
  if (row.side === "approve") return `Approved ${row.ticker}`;
  return "Parked USDT";
}

function activityAmount(row: ActivityRow) {
  if (row.side === "approve") return null;
  const label = row.amountLabel.trim();
  if (!label) return null;
  if (row.side === "park" && !/usdt/i.test(label)) return `${label} USDT`;
  if (row.side === "sell" && !/usdt/i.test(label)) {
    const qty = Number(label);
    if (Number.isFinite(qty)) {
      return qty.toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
  }
  return label;
}

function activityDetail(row: ActivityRow) {
  if (row.status === "failed") {
    if (!row.failReason) return "Didn't land on BSC";
    if (/simulation gate/i.test(row.failReason)) return "Stopped before it was sent";
    if (/execution reverted/i.test(row.failReason)) return "The swap reverted";
    const clean = row.failReason.replace(/^Simulate on gate blocked execute:\s*/i, "");
    return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
  }
  if (row.side === "approve") return "Spending approval for the swap";
  return [row.vendor, row.mode].filter(Boolean).join(" · ");
}

function statusLabel(s: HistoryItem["status"]) {
  if (s === "confirmed") return "Completed";
  if (s === "failed") return "Failed";
  return "Pending";
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function clockLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActivityList({
  activity,
  receipts,
  onOpenReceipt,
  onTradeTicker,
}: {
  activity: ActivityRow[];
  receipts: TradeReceipt[];
  onOpenReceipt?: (r: TradeReceipt) => void;
  onTradeTicker: (ticker: string) => void;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const trades = activity.filter((row) => row.side !== "approve");
  const failed = activity.filter((row) => row.status === "failed");
  const visible =
    filter === "trades" ? trades : filter === "failed" ? failed : activity;
  const groups = useMemo(() => {
    const order: string[] = [];
    const byDay = new Map<string, ActivityRow[]>();
    for (const row of visible) {
      const key = new Date(row.at).toDateString();
      const bucket = byDay.get(key);
      if (bucket) bucket.push(row);
      else {
        order.push(key);
        byDay.set(key, [row]);
      }
    }
    return order.map((key) => ({
      key,
      label: dayLabel(byDay.get(key)![0].at),
      rows: byDay.get(key)!,
    }));
  }, [visible]);
  const completed = activity.filter((row) => row.status === "confirmed" && row.side !== "approve").length;
  const approvals = activity.filter((row) => row.side === "approve").length;

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="display text-2xl">Activity</h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {activity.length === 0
              ? "Fills, failures, and parks from this desk."
              : `${completed} completed · ${failed.length} failed${approvals ? ` · ${approvals} approvals` : ""}`}
          </p>
        </div>
        {activity.length > 0 ? (
          <div className="flex gap-0.5 rounded-full bg-[var(--bg-muted)] p-1">
            {(
              [
                ["all", "All", activity.length],
                ["trades", "Trades", trades.length],
                ["failed", "Failed", failed.length],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  filter === id
                    ? "bg-white text-[var(--ink)] shadow-sm"
                    : "text-[var(--ink-soft)]",
                )}
              >
                {label}
                <span className="ml-1 tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {activity.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-[var(--bg-muted)] px-5 py-10 text-center">
          <p className="font-medium">No activity yet</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            A buy, sell, or park shows up here with its receipt.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-4"
            onClick={() => onTradeTicker("NVDA")}
          >
            Trade
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-[var(--bg-muted)] px-5 py-8 text-center">
          <p className="font-medium">Nothing in this view</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {filter === "failed" ? "No failed trades on this desk." : "No trades yet."}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="px-1 text-xs font-medium tracking-wide text-[var(--ink-soft)]">
                {group.label}
              </p>
              <ul className="mt-2 space-y-1">
                {group.rows.map((h) => {
                  const m = tickerMeta(h.ticker);
                  const receipt = receipts.find((r) => r.id === h.id);
                  const amount = activityAmount(h);
                  const quiet = h.side === "approve";
                  return (
                    <li key={h.id}>
                      <button
                        type="button"
                        className={clsx(
                          "flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-[var(--bg-muted)]",
                          h.status === "failed" && "bg-[#fdecee]/70 hover:bg-[#fdecee]",
                          quiet && "opacity-80",
                        )}
                        onClick={() => receipt && onOpenReceipt?.(receipt)}
                      >
                        <span className="relative h-11 w-11 shrink-0">
                          <span className="absolute inset-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                            <Image
                              src={m.logo}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-contain p-1.5"
                            />
                          </span>
                          <span
                            className={clsx(
                              "absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-white",
                              h.side === "buy" && "bg-[var(--signal-soft)] text-[var(--signal)]",
                              h.side === "sell" && "bg-[#fdecee] text-[var(--danger)]",
                              h.side === "approve" && "bg-[var(--bg-muted)] text-[var(--ink-soft)]",
                              h.side === "park" && "bg-[#fff6d8] text-[#8a5a00]",
                            )}
                            aria-hidden
                          >
                            {h.side === "buy" ? "+" : h.side === "sell" ? "−" : h.side === "approve" ? "✓" : "P"}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{activityTitle(h)}</span>
                          <span className="mt-0.5 block truncate text-sm text-[var(--ink-soft)]">
                            {activityDetail(h)}
                            {activityDetail(h) ? " · " : ""}
                            {clockLabel(h.at)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          {amount ? (
                            <span
                              className={clsx(
                                "block text-sm font-semibold tabular-nums",
                                h.status === "failed" && "text-[var(--danger)]",
                                h.status === "submitted" && "text-[var(--ink-soft)]",
                              )}
                            >
                              {amount}
                            </span>
                          ) : null}
                          <span
                            className={clsx(
                              "mt-0.5 block text-[11px] font-medium",
                              h.status === "confirmed" && "text-[var(--signal)]",
                              h.status === "failed" && "text-[var(--danger)]",
                              h.status === "submitted" && "text-[var(--ink-soft)]",
                            )}
                          >
                            {statusLabel(h.status)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Deterministic portfolio value curve for overview chart. */
function PortfolioSpark({
  seed,
  total,
  range,
  up,
}: {
  seed: string;
  total: number;
  range: Range;
  up: boolean;
}) {
  const { line, area, yTicks, xLabels } = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const mult =
      range === "1D" ? 0.012 : range === "1W" ? 0.04 : range === "1M" ? 0.08 : 0.14;
    const n = 48;
    const vals: number[] = [];
    let v = total * (up ? 1 - mult : 1 + mult * 0.6);
    for (let i = 0; i < n; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      const drift = up ? total * mult * 0.035 : -total * mult * 0.03;
      const noise = ((h % 1000) / 1000 - 0.5) * total * mult * 0.25;
      v = Math.max(total * 0.7, v + drift + noise);
      vals.push(i === n - 1 ? total : v);
    }
    vals[vals.length - 1] = total;
    const min = Math.min(...vals) * 0.995;
    const max = Math.max(...vals) * 1.005;
    const span = max - min || 1;
    const pad = { t: 12, r: 48, b: 28, l: 8 };
    const w = 640;
    const ht = 280;
    const pw = w - pad.l - pad.r;
    const ph = ht - pad.t - pad.b;
    const pts = vals.map((val, i) => {
      const x = pad.l + (i / (n - 1)) * pw;
      const y = pad.t + (1 - (val - min) / span) * ph;
      return { x, y };
    });
    const line = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
    const area = `${line} L${pts[pts.length - 1].x},${pad.t + ph} L${pts[0].x},${pad.t + ph} Z`;
    const yTicks = [0, 0.5, 1].map((t) => {
      const val = min + span * (1 - t);
      return {
        y: pad.t + t * ph,
        label: fmtUsd(val, val >= 100 ? 0 : 2),
      };
    });
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    };
    const labels =
      range === "1D"
        ? ["9:30", "12:00", "15:00", "Now"]
        : range === "1W"
          ? [day(6), day(4), day(2), "Now"]
          : [day(28), day(14), "Now"];
    const xLabels = labels.map((label, i) => ({
      label,
      x: pad.l + (i / (labels.length - 1)) * pw,
    }));
    return { line, area, yTicks, xLabels, w, ht, pad };
  }, [seed, total, range, up]);

  const stroke = up ? "#007a4b" : "#c62828";

  return (
    <svg viewBox="0 0 640 280" className="h-[220px] w-full sm:h-[280px]" aria-hidden>
      <defs>
        <linearGradient id="pfFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((t) => (
        <g key={t.label}>
          <line
            x1={8}
            x2={592}
            y1={t.y}
            y2={t.y}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="1"
          />
          <text x={600} y={t.y + 3.5} fill="#8a8a8a" fontSize="11">
            {t.label}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#pfFill)" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {xLabels.map((t) => (
        <text
          key={t.label}
          x={t.x}
          y={190}
          textAnchor="middle"
          fill="#8a8a8a"
          fontSize="11"
        >
          {t.label}
        </text>
      ))}
    </svg>
  );
}

function Donut({
  segments,
  total,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const parts = segments.filter((s) => s.value > 0.001);

  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#ececec"
          strokeWidth="14"
        />
        {parts.map((s) => {
          const len = total > 0 ? (s.value / total) * c : 0;
          const dash = `${len} ${c - len}`;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-lg bg-white/90 px-3 py-2 text-center shadow-sm ring-1 ring-black/5">
          <div className="display text-lg leading-none">{fmtUsd(total)}</div>
          <div className="mt-1 text-[10px] text-[var(--ink-soft)]">All · 100%</div>
        </div>
      </div>
    </div>
  );
}

export function PortfolioView({
  address,
  portfolio,
  history,
  receipts = [],
  onOpenReceipt,
  costBasis = [],
  loading,
  onRefresh,
  onSell,
  onTradeTicker,
  onConnect,
  onPark,
}: {
  address?: string;
  portfolio: PortfolioData | null;
  history: HistoryItem[];
  receipts?: TradeReceipt[];
  onOpenReceipt?: (r: TradeReceipt) => void;
  costBasis?: CostBasisLot[];
  loading?: boolean;
  onRefresh: () => void;
  onSell: (p: PortfolioPosition) => void;
  onTradeTicker: (ticker: string) => void;
  onConnect: () => void;
  onPark?: () => void;
}) {
  const [range, setRange] = useState<Range>("1W");
  const [allocTab, setAllocTab] = useState<AllocTab>("all");
  const [holdSearch, setHoldSearch] = useState("");

  const usdt = Number(portfolio?.cash?.usdt || 0);
  const bnb = Number(portfolio?.cash?.bnb || 0);
  const bnbUsd = bnb * BNB_USD_EST;
  const positions = portfolio?.positions || [];
  const equity = portfolio?.equityValueUsdt || 0;
  const total = usdt + bnbUsd + equity;

  const activity = useMemo(() => {
    if (receipts.length) {
      return receipts.map((r) => ({
        id: r.id,
        at: r.at,
        side: r.side,
        ticker: r.ticker,
        symbol: r.symbol,
        amountLabel: r.amountLabel,
        mode: r.mode,
        vendor: r.vendor,
        status: r.status,
        failReason: r.failReason,
      }));
    }
    return history;
  }, [receipts, history]);

  const lotByAddr = useMemo(() => {
    const m = new Map<string, CostBasisLot>();
    for (const l of costBasis) m.set(l.contractAddress.toLowerCase(), l);
    return m;
  }, [costBasis]);

  const unrealized = useMemo(() => {
    let cost = 0;
    let value = 0;
    for (const p of positions) {
      const lot = lotByAddr.get(p.contractAddress.toLowerCase());
      if (!lot) continue;
      cost += lot.costUsdt;
      value += p.valueUsdt || 0;
    }
    return { cost, value, pnl: value - cost };
  }, [positions, lotByAddr]);

  const hasBasis = unrealized.cost > 0;
  const changeUsd = hasBasis
    ? unrealized.pnl
    : total *
      ((range === "1D" ? 1.2 : range === "1W" ? 8.1 : range === "1M" ? 12.4 : 18.6) /
        100);
  const changePct =
    hasBasis && unrealized.cost > 0
      ? (unrealized.pnl / unrealized.cost) * 100
      : range === "1D"
        ? 1.2
        : range === "1W"
          ? 8.1
          : range === "1M"
            ? 12.4
            : 18.6;
  const up = changePct >= 0;

  const segments = useMemo(() => {
    const rows = [
      { label: "Cash", value: usdt, color: classColor("Cash") },
      { label: "Crypto", value: bnbUsd, color: classColor("Crypto") },
      { label: "Ondo Stocks", value: 0, color: classColor("Ondo Stocks") },
      { label: "bStocks", value: 0, color: classColor("bStocks") },
      { label: "xStocks", value: 0, color: classColor("xStocks") },
    ];
    for (const p of positions) {
      const label = assetClass(p.kind);
      const row = rows.find((r) => r.label === label);
      if (row) row.value += p.valueUsdt || 0;
      else rows.push({ label, value: p.valueUsdt || 0, color: classColor(label) });
    }
    return rows.filter((r) => r.value > 0.0001);
  }, [usdt, bnbUsd, positions]);

  const filteredSegments =
    allocTab === "all"
      ? segments
      : allocTab === "cash"
        ? segments.filter((s) => s.label === "Cash")
        : allocTab === "crypto"
          ? segments.filter((s) => s.label === "Crypto")
          : segments.filter((s) => s.label !== "Cash" && s.label !== "Crypto");

  const allocTotal = filteredSegments.reduce((s, x) => s + x.value, 0) || total;

  const holdingsRows = useMemo(() => {
    const rows: Array<{
      key: string;
      name: string;
      symbol: string;
      logo: string;
      klass: string;
      price: number | null;
      balance: string;
      value: number;
      position?: PortfolioPosition;
      invest?: boolean;
    }> = [];

    if (usdt > 0) {
      rows.push({
        key: "usdt",
        name: "Tether",
        symbol: "USDT",
        logo: "/brand/logos/usdt.png",
        klass: "Cash",
        price: 1,
        balance: usdt.toFixed(4),
        value: usdt,
        invest: true,
      });
    }
    if (bnb > 0) {
      rows.push({
        key: "bnb",
        name: "BNB",
        symbol: "BNB",
        logo: "/brand/logos/bnb.png",
        klass: "Crypto",
        price: BNB_USD_EST,
        balance: bnb.toFixed(6),
        value: bnbUsd,
      });
    }
    for (const p of positions) {
      const m = tickerMeta(p.ticker || p.symbol);
      rows.push({
        key: p.contractAddress,
        name: m.name,
        symbol: p.symbol,
        logo: m.logo,
        klass: assetClass(p.kind),
        price: p.onChainPrice,
        balance: Number(p.balance).toFixed(6),
        value: p.valueUsdt || 0,
        position: p,
      });
    }
    rows.sort((a, b) => b.value - a.value);
    const q = holdSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.symbol.toLowerCase().includes(q) ||
        r.klass.toLowerCase().includes(q),
    );
  }, [usdt, bnb, bnbUsd, positions, holdSearch]);

  const featured = CORE_TICKERS.slice(0, 4);
  const nowLabel = new Date().toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (!address) {
    return (
      <div data-tour="portfolio" className="mt-8 space-y-6">
        <div className="rounded-[28px] bg-white p-8 text-center ring-1 ring-black/[0.05]">
          <p className="display text-2xl">Connect to view holdings</p>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Balances and allocation appear once a wallet is connected. Desk
            receipts stay on this page.
          </p>
          <button type="button" className="btn btn-primary mt-6" onClick={onConnect}>
            Connect wallet
          </button>
        </div>
        <ActivityList
          activity={activity}
          receipts={receipts}
          onOpenReceipt={onOpenReceipt}
          onTradeTicker={onTradeTicker}
        />
      </div>
    );
  }

  return (
    <div data-tour="portfolio" className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative h-8 w-8 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <Image
              src="/brand/profile.jpg"
              alt=""
              fill
              sizes="32px"
              className="object-cover"
            />
          </span>
          <p className="text-[15px]">
            Welcome,{" "}
            <span className="font-medium">{shortAddr(address)}</span>
          </p>
        </div>
        <p className="text-sm text-[var(--ink-soft)]">{nowLabel}</p>
      </div>

      {/* Overview */}
      <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="display text-4xl sm:text-5xl">{fmtUsd(total)}</h2>
              <span
                className={clsx(
                  "text-sm font-medium",
                  up ? "text-[var(--signal)]" : "text-[var(--danger)]",
                )}
              >
                {up ? "▲" : "▼"} {fmtUsd(Math.abs(changeUsd))} (
                {up ? "+" : ""}
                {changePct.toFixed(2)}%) {range}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Equity {fmtUsd(equity)} · Cash {fmtUsd(usdt)} · Crypto{" "}
              {fmtUsd(bnbUsd)}
              {hasBasis && (
                <>
                  {" "}
                  · Cost basis {fmtUsd(unrealized.cost)} · Unrealized{" "}
                  <span className={up ? "text-[var(--signal)]" : "text-[var(--danger)]"}>
                    {up ? "+" : ""}
                    {fmtUsd(unrealized.pnl)}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5 rounded-full bg-[var(--bg-muted)] p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={clsx(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition",
                    range === r
                      ? "bg-white text-[var(--ink)] shadow-sm"
                      : "text-[var(--ink-soft)]",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost !px-3 !py-2 text-sm"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <PortfolioSpark
            seed={`${address}-${range}`}
            total={Math.max(total, 1)}
            range={range}
            up={up}
          />
        </div>
      </section>

      {/* Holdings */}
      <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="display text-2xl">My Holdings</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--bg-muted)] px-3 py-1.5 text-xs text-[var(--ink-soft)]">
              Asset Class
            </span>
            <span className="rounded-full bg-[var(--bg-muted)] px-3 py-1.5 text-xs text-[var(--ink-soft)]">
              BNB Chain
            </span>
            <input
              value={holdSearch}
              onChange={(e) => setHoldSearch(e.target.value)}
              placeholder="Search asset"
              className="input !h-9 !rounded-full !px-4 !text-sm"
            />
          </div>
        </div>

        {/* Cash feature cards */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#e7f6ee] px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="relative h-11 w-11 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
                <Image
                  src="/brand/logos/usdt.png"
                  alt="USDT"
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </span>
              <div>
                <div className="font-semibold">USDT</div>
                <div className="text-sm text-[var(--ink-soft)]">
                  {fmtUsd(usdt)}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium ring-1 ring-black/10"
              onClick={() => onTradeTicker("NVDA")}
            >
              Invest
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#fff6d8] px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="relative h-11 w-11 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
                <Image
                  src="/brand/logos/bnb.png"
                  alt="BNB"
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </span>
              <div>
                <div className="font-semibold">BNB</div>
                <div className="text-sm text-[var(--ink-soft)]">
                  {bnb.toFixed(4)} · ≈ {fmtUsd(bnbUsd)}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium ring-1 ring-black/10"
              onClick={onRefresh}
            >
              Gas
            </button>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-black/[0.06] md:hidden">
          {holdingsRows.map((r) => (
            <li key={r.key} className="flex items-center gap-3 py-3">
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <Image src={r.logo} alt="" fill className="object-cover" sizes="40px" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.symbol}</div>
                <div className="truncate text-xs text-[var(--ink-soft)]">
                  {r.name} · {r.balance}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{fmtUsd(r.value)}</div>
                {r.position ? (
                  <button
                    type="button"
                    className="mt-1 text-xs font-medium underline"
                    onClick={() => onSell(r.position!)}
                  >
                    Sell
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {holdingsRows.length === 0 ? (
            <li className="py-8 text-center text-sm text-[var(--ink-soft)]">
              No holdings match this filter.
            </li>
          ) : null}
        </ul>
        <div className="mt-6 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 text-[var(--ink-soft)]">
                <th className="pb-3 pr-4 font-medium">Token</th>
                <th className="pb-3 pr-4 font-medium">Asset Class</th>
                <th className="pb-3 pr-4 font-medium">Price ($)</th>
                <th className="pb-3 pr-4 font-medium">Balance</th>
                <th className="pb-3 pr-4 font-medium">Value ($)</th>
                <th className="pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {holdingsRows.map((r) => {
                const lot = r.position
                  ? lotByAddr.get(r.position.contractAddress.toLowerCase())
                  : undefined;
                return (
                <tr
                  key={r.key}
                  className="border-b border-black/[0.04] last:border-0"
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-3">
                      <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[var(--bg-muted)] ring-1 ring-black/5">
                        <Image
                          src={r.logo}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      </span>
                      <div>
                        <div className="font-semibold">{r.symbol}</div>
                        <div className="text-xs text-[var(--ink-soft)]">
                          {r.name}
                          {lot ? ` · avg ${fmtUsd(lot.avgPrice)}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="rounded-full bg-[#f3e8ff] px-2.5 py-1 text-xs font-medium text-[#6b21a8]">
                      {r.klass}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 mono">
                    {r.price != null ? fmtUsd(r.price) : "-"}
                  </td>
                  <td className="py-3.5 pr-4 mono">{r.balance}</td>
                  <td className="py-3.5 pr-4 font-medium">{fmtUsd(r.value)}</td>
                  <td className="py-3.5 text-right">
                    {r.position ? (
                      <button
                        type="button"
                        className="btn btn-primary !px-3 !py-1.5 text-xs"
                        onClick={() => onSell(r.position!)}
                      >
                        Sell
                      </button>
                    ) : r.invest ? (
                      <button
                        type="button"
                        className="btn btn-ghost !px-3 !py-1.5 text-xs"
                        onClick={() => (onPark ? onPark() : onTradeTicker("NVDA"))}
                      >
                        {onPark ? "Park" : "Invest"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
              })}
              {holdingsRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-[var(--ink-soft)]"
                  >
                    No holdings match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Allocation */}
      <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
        <h3 className="display text-2xl">Portfolio Allocation</h3>
        <div className="mt-3 flex gap-4 overflow-x-auto border-b border-black/5 text-sm">
          {(
            [
              ["all", "All Assets"],
              ["crypto", "Crypto"],
              ["equity", "Tokenized Stocks"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAllocTab(id)}
              className={clsx(
                "shrink-0 whitespace-nowrap pb-3 font-medium transition",
                allocTab === id
                  ? "border-b-2 border-[var(--ink)] text-[var(--ink)]"
                  : "text-[var(--ink-soft)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-6 grid items-center gap-8 md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)] md:gap-10">
          <div className="mx-auto w-full max-w-[240px] md:mx-0">
            <Donut segments={filteredSegments} total={allocTotal || 1} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-sm text-[var(--ink-soft)]">Total Value</div>
                <div className="display mt-1 text-3xl">
                  {fmtUsd(allocTotal)}
                </div>
              </div>
              <div className="text-sm text-[var(--ink-soft)]">
                {total > 0
                  ? `${((allocTotal / total) * 100).toFixed(2)}% of Portfolio`
                  : "-"}
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {(filteredSegments.length ? filteredSegments : segments).map(
                (s) => (
                  <li
                    key={s.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: s.color }}
                      />
                      <span className="truncate font-medium">{s.label}</span>
                      {s.label === "Cash" && (
                        <span className="relative h-4 w-4 overflow-hidden rounded-full">
                          <Image src="/brand/logos/usdt.png" alt="" fill sizes="16px" />
                        </span>
                      )}
                      {s.label === "Crypto" && (
                        <span className="relative h-4 w-4 overflow-hidden rounded-full">
                          <Image src="/brand/logos/bnb.png" alt="" fill sizes="16px" />
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4 tabular-nums sm:gap-6">
                      <span className="w-14 text-right text-[var(--ink-soft)] sm:w-16">
                        {allocTotal > 0
                          ? `${((s.value / allocTotal) * 100).toFixed(2)}%`
                          : "0%"}
                      </span>
                      <span className="w-[4.5rem] text-right font-medium sm:w-24">
                        {fmtUsd(s.value)}
                      </span>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </section>

      <ActivityList
        activity={activity}
        receipts={receipts}
        onOpenReceipt={onOpenReceipt}
        onTradeTicker={onTradeTicker}
      />

      {/* Investors also own */}
      <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="display text-2xl">Investors Also Own</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Start building with OpenVenue&apos;s most traded wrappers on BNB
              Chain.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost !px-4 !py-2 text-sm"
            onClick={() => onTradeTicker("NVDA")}
          >
            Explore markets
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((t) => {
            const m = tickerMeta(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTradeTicker(t)}
                className="rounded-[22px] bg-[var(--bg-muted)] p-4 text-left transition hover:bg-[var(--bg-soft)]"
              >
                <div className="flex items-center gap-3">
                  <span className="relative h-10 w-10 overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
                    <Image src={m.logo} alt="" fill sizes="40px" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{m.onSymbol}</div>
                    <div className="truncate text-xs text-[var(--ink-soft)]">
                      {m.name}
                    </div>
                  </div>
                </div>
                <Sparkline seed={t} height={48} className="mt-3 w-full" />
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--signal)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
                    Asset Open
                  </span>
                  <span className="relative h-4 w-4 overflow-hidden rounded-full">
                    <Image src="/brand/logos/bnb.png" alt="BNB" fill sizes="16px" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
