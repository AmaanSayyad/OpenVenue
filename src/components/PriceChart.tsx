"use client";

import { useEffect, useId, useMemo, useState } from "react";
import clsx from "clsx";
import type { ChartRange } from "@/lib/binance/kline";
import { loadChart, type ChartPayload } from "@/lib/venue/chartQuote";
import { tradingViewSymbol } from "@/lib/venue/tickers";

type CandlePt = { t: number; o: number; h: number; l: number; c: number; v: number };

type ChartOk = {
  ok: true;
  source: string;
  last: number;
  change: number;
  changePct: number;
  candles: CandlePt[];
  symbol?: string;
  kind?: string;
  contract?: string;
  interval?: string;
};

type ChartFail = {
  ok: false;
  fallback?: "tradingview";
  ticker?: string;
  error?: string;
};

const RANGES: ChartRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

function fmtPrice(n: number) {
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

function fmtAxisTime(t: number, range: ChartRange) {
  const d = new Date(t);
  if (range === "1D") {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (range === "1W" || range === "1M") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function fmtHoverTime(t: number, range: ChartRange) {
  const d = new Date(t);
  if (range === "1D") {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Light tension curve - avoids overshoot spikes on noisy candles */
function buildSmoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)} L${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)}`;
  }
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    // Low tension (÷10) keeps the curve close to the true closes
    const cp1x = p1.x + (p2.x - p0.x) / 10;
    const cp1y = p1.y + (p2.y - p0.y) / 10;
    const cp2x = p2.x - (p3.x - p1.x) / 10;
    const cp2y = p2.y - (p3.y - p1.y) / 10;
    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function axisTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  return Array.from({ length: count }, (_, i) => {
    const v = min + (span * i) / (count - 1);
    return v;
  });
}

export function PriceChart({
  ticker,
  contract,
  className,
  onQuote,
}: {
  ticker: string;
  contract?: string | null;
  className?: string;
  onQuote?: (q: { last: number; changePct: number; change: number }) => void;
}) {
  const gid = useId().replace(/:/g, "");
  const [range, setRange] = useState<ChartRange>("1D");
  const [mode, setMode] = useState<"token" | "tradingview">("token");
  const [data, setData] = useState<ChartOk | null>(null);
  const [fail, setFail] = useState<ChartFail | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  const equity = tradingViewSymbol(ticker);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setFail(null);
    setHover(null);

    const load = (attempt: number) => {
      loadChart(ticker, range, contract)
        .then((json: ChartPayload) => {
          if (cancelled) return;
          if (json.ok && json.last != null && json.candles && json.candles.length > 1) {
            const ok: ChartOk = {
              ok: true,
              source: json.source || "binance-rwa-kline",
              last: json.last,
              change: json.change ?? 0,
              changePct: json.changePct ?? 0,
              candles: json.candles,
              symbol: json.symbol,
              kind: json.kind,
              contract: json.contract,
            };
            setData(ok);
            setMode("token");
            setFail(null);
            onQuote?.({
              last: ok.last,
              changePct: ok.changePct,
              change: ok.change,
            });
            setLoading(false);
            return;
          }
          if (/rate limit/i.test(json.error || "") && attempt < 3) {
            timer = setTimeout(() => load(attempt + 1), 700 * (attempt + 1));
            return;
          }
          setData(null);
          setFail({
            ok: false,
            fallback: "tradingview",
            ticker: json.ticker,
            error: json.error,
          });
          if (!/rate limit/i.test(json.error || "")) setMode("tradingview");
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          setData(null);
          setFail({
            ok: false,
            fallback: "tradingview",
            error: e instanceof Error ? e.message : "Chart error",
          });
          setMode("tradingview");
          setLoading(false);
        });
    };

    load(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ticker, contract, range, onQuote]);

  const chart = useMemo(() => {
    const candles = data?.candles || [];
    if (candles.length < 2) return null;

    const w = 720;
    const h = 360;
    const pad = { top: 8, right: 58, bottom: 36, left: 4 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Downsample dense series so the line stays readable
    const step = candles.length > 160 ? Math.ceil(candles.length / 140) : 1;
    const series =
      step === 1
        ? candles
        : candles.filter((_, i) => i % step === 0 || i === candles.length - 1);

    const prices = series.map((c) => c.c);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const padPct = (rawMax - rawMin || rawMax * 0.01) * 0.04;
    const min = rawMin - padPct;
    const max = rawMax + padPct;
    const span = max - min || 1;

    const pts = series.map((c, i) => {
      const x = pad.left + (i / (series.length - 1)) * plotW;
      const y = pad.top + (1 - (c.c - min) / span) * plotH;
      return { x, y, ...c };
    });

    const line = buildSmoothPath(pts);
    const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},${(pad.top + plotH).toFixed(2)} L${pts[0].x.toFixed(2)},${(pad.top + plotH).toFixed(2)} Z`;

    const yTicks = axisTicks(min, max, 5).map((v) => ({
      v,
      y: pad.top + (1 - (v - min) / span) * plotH,
    }));

    const xCount = 5;
    const xTicks = Array.from({ length: xCount }, (_, i) => {
      const idx = Math.round((i / (xCount - 1)) * (series.length - 1));
      return { i: idx, x: pts[idx].x, t: pts[idx].t };
    });

    return { line, area, pts, w, h, pad, plotH, min, max, yTicks, xTicks };
  }, [data]);

  const up = (data?.changePct ?? 0) >= 0;
  const stroke = up ? "#007a4b" : "#c62828";
  const active =
    hover != null && chart ? chart.pts[hover] : chart?.pts[chart.pts.length - 1];

  const tint = up ? "bg-[#e7f6ee]" : "bg-[#fdecee]";

  return (
    <div className={clsx("flex h-full flex-col", className)}>
      <div
        className={clsx(
          "relative overflow-hidden rounded-[22px] px-4 pb-2 pt-5 sm:px-6 sm:pt-6",
          tint,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {mode === "token" && data ? (
              <>
                <div className="text-[34px] font-semibold leading-none tracking-tight sm:text-[42px]">
                  ${fmtPrice(active?.c ?? data.last)}
                </div>
                <div
                  className={clsx(
                    "mt-2 text-[14px] font-medium",
                    up ? "text-[#0b7a45]" : "text-[#c62828]",
                  )}
                >
                  {up ? "▲" : "▼"} ${Math.abs(data.change).toFixed(2)} (
                  {Math.abs(data.changePct).toFixed(2)}%) {range === "1D" ? "24H" : range}
                  {active && hover != null
                    ? ` · ${fmtHoverTime(active.t, range)}`
                    : ""}
                </div>
              </>
            ) : (
              <div className="text-[14px] font-medium text-[var(--ink-soft)]">
                {loading
                  ? "Loading chart…"
                  : mode === "tradingview"
                    ? "Underlying equity"
                    : fail?.error || "Chart"}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex rounded-full bg-white p-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setMode("token");
                    setRange(r);
                  }}
                  className={clsx(
                    "rounded-full px-2 py-1 text-[12px] font-medium transition sm:px-2.5",
                    range === r && mode === "token"
                      ? "bg-[var(--ink)] text-white"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="text-[11px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
              onClick={() =>
                setMode((m) => (m === "token" ? "tradingview" : "token"))
              }
            >
              {mode === "token" ? "TradingView" : "Token chart"}
            </button>
          </div>
        </div>

      <div className="relative mt-2 min-h-[280px]">
        {loading && mode === "token" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 text-sm text-[var(--ink-soft)] backdrop-blur-sm">
            Loading chart…
          </div>
        )}

        {mode === "token" && chart && (
          <svg
            viewBox={`0 0 ${chart.w} ${chart.h}`}
            className="h-[300px] w-full sm:h-[360px]"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`${ticker} price chart`}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
                <stop offset="50%" stopColor={stroke} stopOpacity="0.08" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid + Y labels */}
            {chart.yTicks.map((tick) => (
              <g key={tick.v}>
                <line
                  x1={chart.pad.left}
                  x2={chart.w - chart.pad.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="rgba(0,0,0,0.06)"
                  strokeWidth="1"
                />
                <text
                  x={chart.w - chart.pad.right + 8}
                  y={tick.y + 3.5}
                  fill="#626262"
                  fontSize="12"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {fmtPrice(tick.v)}
                </text>
              </g>
            ))}

            {/* Baseline */}
            <line
              x1={chart.pad.left}
              x2={chart.w - chart.pad.right}
              y1={chart.pad.top + chart.plotH}
              y2={chart.pad.top + chart.plotH}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="1"
            />

            {/* Area + line */}
            <path d={chart.area} fill={`url(#fill-${gid})`} />
            <path
              d={chart.line}
              fill="none"
              stroke={stroke}
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* X labels */}
            {chart.xTicks.map((tick) => (
              <text
                key={tick.t}
                x={tick.x}
                y={chart.h - 14}
                textAnchor="middle"
                fill="#626262"
                fontSize="12"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {fmtAxisTime(tick.t, range)}
              </text>
            ))}

            {/* Hit targets */}
            {chart.pts.map((p, i) => (
              <rect
                key={p.t}
                x={p.x - chart.w / chart.pts.length / 2}
                y={chart.pad.top}
                width={Math.max(chart.w / chart.pts.length, 4)}
                height={chart.plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}

            {/* Crosshair + dot */}
            {active && (
              <>
                <line
                  x1={active.x}
                  x2={active.x}
                  y1={chart.pad.top}
                  y2={chart.pad.top + chart.plotH}
                  stroke="rgba(0,0,0,0.18)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={chart.pad.left}
                  x2={chart.w - chart.pad.right}
                  y1={active.y}
                  y2={active.y}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={active.x}
                  cy={active.y}
                  r="5.5"
                  fill={stroke}
                  stroke="#fff"
                  strokeWidth="2.5"
                />
              </>
            )}
          </svg>
        )}

        {mode === "token" && !loading && !chart && (
          <div className="flex h-[240px] flex-col items-center justify-center gap-3 text-sm text-[var(--ink-soft)] sm:h-[300px]">
            <p>{fail?.error || "Token chart unavailable"}</p>
            <button
              type="button"
              className="btn btn-ghost !px-4 !py-2 text-sm"
              onClick={() => setMode("tradingview")}
            >
              Open TradingView
            </button>
          </div>
        )}

        {mode === "tradingview" && <TradingViewEmbed symbol={equity} />}
      </div>
      </div>
    </div>
  );
}

function TradingViewEmbed({ symbol }: { symbol: string }) {
  const src = useMemo(() => {
    const params = new URLSearchParams({
      symbol,
      interval: "D",
      theme: "light",
      style: "1",
      locale: "en",
      toolbarbg: "f4f4f4",
      enable_publishing: "false",
      hide_top_toolbar: "false",
      hide_legend: "false",
      save_image: "false",
      calendar: "false",
      hideideas: "1",
      studies: "",
    });
    return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
  }, [symbol]);

  return (
    <div className="overflow-hidden rounded-[20px] bg-white">
      <iframe
        title={`TradingView ${symbol}`}
        src={src}
        className="h-[280px] w-full border-0 sm:h-[320px]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="px-3 py-2 text-[11px] text-[var(--ink-soft)]">
        Underlying equity via TradingView · {symbol}
      </p>
    </div>
  );
}
