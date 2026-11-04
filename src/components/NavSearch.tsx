"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CORE_TICKERS, tickerMeta } from "@/lib/venue/tickers";

type Hit = {
  ticker: string;
  symbol: string;
  name: string;
  logo: string;
  kindLabel?: string;
  onChainPrice?: number | null;
};

function fmt(n: number | null | undefined) {
  if (n == null) return null;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function NavSearch({
  dark = false,
  solid = false,
}: {
  dark?: boolean;
  solid?: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>(() =>
    CORE_TICKERS.slice(0, 6).map((t) => {
      const m = tickerMeta(t);
      return { ticker: t, symbol: m.onSymbol, name: m.name, logo: m.logo };
    }),
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setHits(
        CORE_TICKERS.slice(0, 6).map((t) => {
          const m = tickerMeta(t);
          return { ticker: t, symbol: m.onSymbol, name: m.name, logo: m.logo };
        }),
      );
      setLoading(false);
      return;
    }

    // Instant local filter
    const lower = query.toLowerCase();
    const local = CORE_TICKERS.filter((t) => {
      const m = tickerMeta(t);
      return (
        t.toLowerCase().includes(lower) ||
        m.name.toLowerCase().includes(lower) ||
        m.onSymbol.toLowerCase().includes(lower)
      );
    }).map((t) => {
      const m = tickerMeta(t);
      return { ticker: t, symbol: m.onSymbol, name: m.name, logo: m.logo };
    });
    setHits(local);

    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/venue/search?q=${encodeURIComponent(query)}`,
        ).then((r) => r.json());
        if (res.ok && Array.isArray(res.results)) {
          setHits(
            res.results.map(
              (r: {
                ticker: string;
                symbol: string;
                name: string;
                logo: string;
                kindLabel?: string;
                onChainPrice?: number | null;
              }) => ({
                ticker: r.ticker,
                symbol: r.symbol,
                name: r.name,
                logo: r.logo || tickerMeta(r.ticker).logo,
                kindLabel: r.kindLabel,
                onChainPrice: r.onChainPrice,
              }),
            ),
          );
        }
      } catch {
        /* keep local */
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(id);
  }, [q]);

  function pick(hit: Hit) {
    setOpen(false);
    setQ("");
    router.push(`/app?tab=trade&ticker=${encodeURIComponent(hit.ticker)}`);
  }

  return (
    <div ref={rootRef} className="relative hidden w-[168px] shrink-0 xl:block">
      <label className="relative mx-auto block max-w-[300px]">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={clsx(dark && "text-white/60")}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search assets"
          className={clsx(
            "h-9 w-full rounded-full border-0 pl-9 pr-3 text-[13px] outline-none transition placeholder:text-[var(--ink-soft)]",
            solid && "bg-[var(--bg-muted)] text-[var(--ink)]",
            dark && "bg-white/10 text-white placeholder:text-white/45",
            !solid && !dark && "bg-black/[0.06] text-black",
          )}
        />
      </label>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[60] w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
          <div className="flex items-center justify-between border-b border-black/5 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--ink-soft)]">
            <span>{q.trim() ? "Results" : "Popular"}</span>
            {loading && <span>Searching…</span>}
          </div>
          <ul className="max-h-80 overflow-y-auto p-1.5">
            {hits.map((h) => (
              <li key={`${h.ticker}-${h.symbol}`}>
                <button
                  type="button"
                  onClick={() => pick(h)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--bg-muted)]"
                >
                  <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <Image
                      src={h.logo}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                      {h.symbol}
                      {h.kindLabel && (
                        <span className="ml-1.5 text-[11px] font-medium text-[var(--ink-soft)]">
                          {h.kindLabel}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-[var(--ink-soft)]">
                      {h.name}
                    </span>
                  </span>
                  {fmt(h.onChainPrice) && (
                    <span className="text-xs font-medium tabular-nums text-[var(--ink)]">
                      {fmt(h.onChainPrice)}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {hits.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-[var(--ink-soft)]">
                No tokens match “{q}”
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
