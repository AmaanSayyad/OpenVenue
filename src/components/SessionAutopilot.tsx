"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  getUsEquitySession,
  sessionPrefersAmm,
} from "@/lib/venue/session";
import type { SessionState } from "@/lib/venue/types";

function formatCountdown(ms: number) {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const WHY: Record<SessionState, string> = {
  open: "US markets are open. Quote venues are usually the deepest.",
  pre_market: "Pre-market. On-chain pools are the deeper route right now.",
  after_hours: "After hours. On-chain pools stay open.",
  closed: "US markets are closed. Trading continues on the 24/7 pools.",
  weekend: "Weekend. On-chain pools are the live route.",
};

export function SessionAutopilot({
  session,
  className,
}: {
  session: {
    state: string;
    label: string;
    nextOpenIso: string;
  } | null;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const live = session || (() => {
    const s = getUsEquitySession();
    return {
      state: s.state,
      label: s.label,
      nextOpenIso: s.nextOpen.toISOString(),
    };
  })();

  const state = live.state as SessionState;
  const prefersAmm = sessionPrefersAmm(state);
  const nextMs = new Date(live.nextOpenIso).getTime() - now;

  return (
    <div
      data-tour="session"
      className={clsx(
        "flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[22px] bg-white px-3 py-2.5 ring-1 ring-black/[0.06] sm:h-[52px] sm:flex-nowrap sm:gap-3 sm:overflow-hidden sm:rounded-full sm:px-4 sm:py-0",
        className,
      )}
    >
      <span className="mono shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
        Session
      </span>
      <span className="badge-live shrink-0">{state.replaceAll("_", " ")}</span>
      <span className="shrink-0 rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-xs font-medium">
        {prefersAmm ? "On-chain pools" : "Quote venues"}
      </span>
      <p className="basis-full text-sm text-[var(--ink-soft)] sm:min-w-0 sm:flex-1 sm:basis-auto sm:truncate">
        {WHY[state] || live.label}
      </p>
      <span className="shrink-0 text-xs text-[var(--ink-soft)]">
        Next US open
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {formatCountdown(nextMs)}
      </span>
    </div>
  );
}
