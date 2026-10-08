"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { loadStrategies, type DeskStrategy } from "@/lib/venue/strategies";
import { tickerMeta } from "@/lib/venue/tickers";

export function SavedStrategies({
  onRun,
}: {
  onRun: (s: DeskStrategy) => void;
}) {
  const [items, setItems] = useState<DeskStrategy[]>([]);

  useEffect(() => {
    setItems(loadStrategies());
  }, []);

  return (
    <div>
      <h3 className="display text-[clamp(1.8rem,3vw,2.4rem)]">Strategies</h3>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">
        One tap finds the best wrapper. If the quote is wider than the limit,
        the playbook either parks the USDT or stops.
      </p>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {items.map((s) => {
          const m = tickerMeta(s.ticker);
          const pct = (s.maxSpreadBps / 100).toFixed(2);
          return (
            <li
              key={s.id}
              className="flex flex-col rounded-[24px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04]"
            >
              <div className="flex items-center gap-3">
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <Image
                    src={m.logo}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-contain p-1.5"
                  />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[17px] font-semibold">
                    {m.name}
                  </div>
                  <div className="truncate text-[13px] text-[var(--ink-soft)]">
                    {s.name}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                ${s.amountUsdt}
                <span className="ml-1 text-sm font-medium text-[var(--ink-soft)]">
                  USDT
                </span>
              </p>
              <p className="mt-3 text-sm leading-snug text-[var(--ink)]">
                Buys the best wrapper if the quote is within {pct}% of the
                reference price.
              </p>
              <p className="mt-2 text-sm leading-snug text-[var(--ink-soft)]">
                {s.parkIfNoQuote
                  ? "If it is wider, the USDT is parked instead."
                  : "If it is wider, the run stops and nothing is sent."}
              </p>
              <button
                type="button"
                className="btn btn-primary mt-5 w-full"
                onClick={() => onRun(s)}
              >
                Run {m.name}
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        href="/marketplace"
        className="mt-4 flex items-center justify-between gap-4 rounded-[24px] bg-white px-5 py-4 text-sm ring-1 ring-black/[0.06] transition hover:bg-[var(--bg-muted)]"
      >
        <span>
          <span className="block font-semibold">List Venue Tape</span>
          <span className="text-[var(--ink-soft)]">
            Sell the same desk as an agent on the marketplace.
          </span>
        </span>
        <span className="shrink-0 font-medium">Open →</span>
      </Link>
    </div>
  );
}
