"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import clsx from "clsx";
import { Sparkline } from "@/components/Sparkline";
import { loadChart } from "@/lib/venue/chartQuote";
import { CORE_TICKERS, tickerMeta } from "@/lib/venue/tickers";

const VENUE_LOGOS = [
  "/brand/partners/p4.svg",
  "/brand/partners/p2.svg",
  "/brand/partners/p10.svg",
  "/brand/partners/p12.svg",
  "/brand/partners/p8.svg",
  "/brand/logos/bnb.png",
];

type Quote = {
  last: number;
  change: number;
  changePct: number;
};

function AlsoOwnCard({
  ticker,
  index,
  onSelect,
}: {
  ticker: string;
  index: number;
  onSelect: (t: string) => void;
}) {
  const m = tickerMeta(ticker);
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadChart(ticker, "1D")
      .then((d) => {
        if (cancelled || !d.ok || d.last == null) return;
        setQuote({
          last: Number(d.last),
          change: Number(d.change ?? 0),
          changePct: Number(d.changePct ?? 0),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const up = (quote?.changePct ?? 0) >= 0;
  const tint = quote ? (up ? "bg-[#e8f6ef]" : "bg-[#fdeced]") : "bg-[var(--bg-muted)]";
  const tone = up ? "text-[var(--signal)]" : "text-[var(--danger)]";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onSelect(ticker)}
      className="flex flex-col rounded-[20px] border border-black/[0.08] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-center gap-2.5">
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[10px] bg-[var(--bg-muted)] ring-1 ring-black/5">
          <Image
            src={m.logo}
            alt=""
            fill
            className="object-cover"
            sizes="36px"
          />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-tight">
            {m.onSymbol}
          </div>
          <div className="truncate text-[13px] text-[var(--ink-soft)]">
            {m.name}
          </div>
        </div>
      </div>

      <div className={clsx("mt-3 overflow-hidden rounded-[16px] px-3 pb-1 pt-4", tint)}>
        <div className="text-[28px] font-semibold tracking-tight tabular-nums">
          {quote
            ? `$${quote.last.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—"}
        </div>
        <div className={clsx("mt-0.5 text-[12px] font-medium tabular-nums", tone)}>
          {quote
            ? `${up ? "▲" : "▼"} $${Math.abs(quote.change).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} (${Math.abs(quote.changePct).toFixed(2)}%) 24H`
            : "Price unavailable"}
        </div>
        {quote ? (
          <Sparkline
            seed={ticker}
            up={up}
            height={120}
            className="mt-1 w-full"
          />
        ) : (
          <div className="mt-1 h-[120px]" />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
          Asset Open
        </div>
        <div className="flex items-center -space-x-1.5">
          {VENUE_LOGOS.map((src) => (
            <span
              key={src}
              className="relative h-5 w-5 overflow-hidden rounded-full bg-white ring-1 ring-black/10"
            >
              <Image src={src} alt="" fill className="object-contain p-0.5" sizes="20px" />
            </span>
          ))}
        </div>
      </div>
    </motion.button>
  );
}

export function AlsoOwnSection({
  excludeTicker,
  onSelect,
  onExplore,
}: {
  excludeTicker?: string;
  onSelect: (ticker: string) => void;
  onExplore?: () => void;
}) {
  const tickers = CORE_TICKERS.filter((t) => t !== excludeTicker).slice(0, 4);

  return (
    <section className="rounded-[28px] border border-black/[0.06] bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="display text-2xl leading-none sm:text-[28px]">
          Investors Also Own
        </h3>
        <button
          type="button"
          className="shrink-0 rounded-full bg-[var(--bg-muted)] px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition hover:bg-black/[0.06]"
          onClick={onExplore}
        >
          Explore markets
        </button>
      </div>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">
        Start building your portfolio with OpenVenue&apos;s latest tokenized stock
        opportunities on BNB Chain.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {tickers.map((t, i) => (
          <AlsoOwnCard
            key={t}
            ticker={t}
            index={i}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
