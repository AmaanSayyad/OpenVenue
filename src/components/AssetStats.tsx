"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type Ohlc = { open: number; high: number; low: number; close?: number };

type SessionRow = {
  session: string;
  hours: string;
  limit: number;
  icon: string;
};

type StatsPayload = {
  ok: boolean;
  tokenOhlc: Ohlc | null;
  underlyingOhlc: Ohlc | null;
  stock: {
    marketCap: number | null;
    volume: number | null;
    averageVolume: number | null;
    dividendYield: number | null;
    lastCashAmount: number | null;
    high52w: number | null;
    low52w: number | null;
    pe: number | null;
  } | null;
  sessionLimits: {
    marketHours: SessionRow[];
    offHours: SessionRow[];
    marketHoursLabel: string;
    offHoursLabel: string;
  };
};

function fmtUsd(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function fmtInt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString();
}

function fmtLimit(n: number) {
  return `$${n.toLocaleString()}`;
}

function StatTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] font-medium text-[var(--ink-soft)]">{title}</div>
      <div className="mt-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-black/[0.05] py-3 text-[14px]"
          >
            <span className="text-[var(--ink-soft)]">{row.label}</span>
            <span className="font-medium tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionIcon({ kind }: { kind: string }) {
  if (kind === "sun") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff4d6] text-sm">
        ☀
      </span>
    );
  }
  if (kind === "moon") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ebe7ff] text-sm">
        ☾
      </span>
    );
  }
  if (kind === "off") {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ececec] text-sm">
        ◷
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e8f1ff] text-sm">
      ⇄
    </span>
  );
}

export function AssetStats({
  ticker,
  contract,
  className,
}: {
  ticker: string;
  contract?: string | null;
  className?: string;
}) {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ ticker });
    if (contract) qs.set("contract", contract);
    fetch(`/api/venue/stats?${qs}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.ok) setData(json);
        else if (!cancelled) setData(null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, contract]);

  if (loading && !data) {
    return (
      <div
        className={clsx(
          "rounded-[22px] border border-black/[0.08] bg-white p-5 text-sm text-[var(--ink-soft)]",
          className,
        )}
      >
        Loading statistics…
      </div>
    );
  }

  if (!data) return null;

  const tok = data.tokenOhlc;
  const und = data.underlyingOhlc;
  const stock = data.stock;

  return (
    <div className={clsx("space-y-4", className)}>
      <section className="rounded-[22px] border border-black/[0.08] bg-white p-5 sm:p-6">
        <h3 className="text-[17px] font-semibold">Statistics</h3>

        <div className="mt-5 grid gap-x-12 gap-y-8 md:grid-cols-2">
          <StatTable
            title="Token Price (24H)"
            rows={[
              { label: "Open", value: fmtUsd(tok?.open) },
              { label: "High", value: fmtUsd(tok?.high) },
              { label: "Low", value: fmtUsd(tok?.low) },
            ]}
          />
          <StatTable
            title="Underlying Asset Price (24H)"
            rows={[
              { label: "Open", value: fmtUsd(und?.open) },
              { label: "High", value: fmtUsd(und?.high) },
              { label: "Low", value: fmtUsd(und?.low) },
            ]}
          />
          <StatTable
            title="Underlying Asset Statistics"
            rows={[
              { label: "Total Market Cap", value: fmtUsd(stock?.marketCap, 2) },
              { label: "24h Volume", value: fmtInt(stock?.volume) },
              { label: "Average Volume", value: fmtInt(stock?.averageVolume) },
              ...(stock?.high52w != null
                ? [
                    { label: "52W High", value: fmtUsd(stock.high52w) },
                    { label: "52W Low", value: fmtUsd(stock.low52w) },
                    {
                      label: "P/E",
                      value: stock.pe != null ? stock.pe.toFixed(2) : "-",
                    },
                  ]
                : []),
            ]}
          />
          <StatTable
            title="Underlying Asset Dividend"
            rows={[
              {
                label: "Dividend Yield",
                value:
                  stock?.dividendYield != null
                    ? `${stock.dividendYield.toFixed(2)}%`
                    : "-",
              },
              {
                label: "Payout Frequency",
                value:
                  stock?.dividendYield != null || stock?.lastCashAmount != null
                    ? "Quarterly"
                    : "-",
              },
              {
                label: "Last Dividend Amount",
                value: fmtUsd(stock?.lastCashAmount),
              },
            ]}
          />
        </div>
      </section>

      <section className="rounded-[22px] border border-black/[0.08] bg-white p-5 sm:p-6">
        <h3 className="text-[17px] font-semibold">Session Limits</h3>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--ink-soft)]">
          Maximum single trade size for this asset in each US session. Off-hours
          is the net position cap while the cash market is closed.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 text-[12px] text-[var(--ink-soft)]">
                <th className="pb-3 pr-4 font-medium">Session</th>
                <th className="pb-3 pr-4 font-medium">Hours (ET)</th>
                <th className="pb-3 font-medium">Limit ($)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={3}
                  className="pb-2 pt-4 text-[12px] font-medium text-[var(--ink-soft)]"
                >
                  Market Hours ({data.sessionLimits.marketHoursLabel})
                </td>
              </tr>
              {data.sessionLimits.marketHours.map((row) => (
                <tr
                  key={row.session}
                  className="border-b border-black/[0.04]"
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2.5 font-medium">
                      <SessionIcon kind={row.icon} />
                      {row.session}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 text-[var(--ink-soft)]">
                    {row.hours}
                  </td>
                  <td className="py-3.5 font-semibold tabular-nums">
                    {fmtLimit(row.limit)}
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  colSpan={3}
                  className="pb-2 pt-5 text-[12px] font-medium text-[var(--ink-soft)]"
                >
                  Off Market Hours ({data.sessionLimits.offHoursLabel})
                </td>
              </tr>
              {data.sessionLimits.offHours.map((row) => (
                <tr key={row.session}>
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2.5 font-medium">
                      <SessionIcon kind={row.icon} />
                      {row.session}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 text-[var(--ink-soft)]">
                    {row.hours}
                  </td>
                  <td className="py-3.5 font-semibold tabular-nums">
                    {fmtLimit(row.limit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
