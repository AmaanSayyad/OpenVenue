"use client";

import { useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { CORE_TICKERS, tickerMeta } from "@/lib/venue/tickers";

type RailId = "wallet" | "pay" | "seller";

type RailResult = {
  rail: RailId;
  name: string;
  ok: boolean;
  detail: string;
  raw?: unknown;
};

const RAILS: {
  id: RailId;
  title: string;
  body: string;
  steps: { name: string; hint: string }[];
}[] = [
  {
    id: "wallet",
    title: "Wallet",
    body: "The wallet has to answer before a buyer can be quoted.",
    steps: [
      { name: "Status", hint: "Is the wallet answering?" },
      { name: "Gas", hint: "BNB Chain gas tiers" },
      { name: "Quote", hint: "A live route for this amount" },
      { name: "Earn", hint: "Where idle USDT can park" },
    ],
  },
  {
    id: "pay",
    title: "Payment",
    body: "Buyers pay $0.05 USDT before the tape is served.",
    steps: [
      { name: "Challenge", hint: "A $0.05 request before the tape" },
      { name: "Preview", hint: "The wallet reads that request" },
    ],
  },
  {
    id: "seller",
    title: "Seller",
    body: "The agent that takes the order and sends the reply.",
    steps: [{ name: "Agent", hint: "Installed and answering" }],
  },
];

const AMOUNTS = ["5", "15", "50"];

export function TapeSellPanel() {
  const [ticker, setTicker] = useState("NVDA");
  const [amount, setAmount] = useState("15");
  const [rows, setRows] = useState<RailResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function baw(op: string, extra?: Record<string, string>) {
    const res = await fetch("/api/venue/baw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, ...extra }),
    }).then((r) => r.json());
    return res as {
      ok?: boolean;
      missingCli?: boolean;
      stderr?: string;
      stdout?: string;
      json?: unknown;
      error?: string;
    };
  }

  async function run() {
    setLoading(true);
    const next: RailResult[] = [];
    try {
      const resolved = await fetch(
        `/api/venue/resolve?ticker=${encodeURIComponent(ticker)}&amount=${encodeURIComponent(amount)}`,
      ).then((r) => r.json());
      const best = resolved?.decision?.bestQuote;
      next.push({
        rail: "wallet",
        name: "Status",
        ok: Boolean(resolved?.ok),
        detail: resolved?.ok
          ? "The desk reached BNB Chain and Binance."
          : resolved?.error || "The desk could not reach Binance.",
        raw: resolved?.ok ? { ticker: resolved.decision?.ticker } : resolved,
      });

      const gas = await baw("gas");
      const gasWei = (gas.json as { gasPrice?: string } | undefined)?.gasPrice;
      next.push({
        rail: "wallet",
        name: "Gas",
        ok: Boolean(gas.ok),
        detail: gas.ok
          ? gasWei
            ? `BNB Chain gas is ${gasWei} wei.`
            : "BNB Chain gas is available."
          : "Couldn’t read BNB Chain gas.",
        raw: gas.json,
      });

      next.push({
        rail: "wallet",
        name: "Quote",
        ok: Boolean(best?.route?.quoteId),
        detail: best?.route?.quoteId
          ? `${amount} USDT → ${best.candidate?.symbol || ticker} via ${best.route.vendorName || best.route.executionMode}.`
          : resolved?.decision?.reason || "No live wrapper for this amount.",
        raw: best
          ? {
              symbol: best.candidate?.symbol,
              out: best.outAmountHuman,
              mode: best.route?.executionMode,
            }
          : undefined,
      });

      const earn = await fetch("/api/venue/park").then((r) => r.json());
      const earnCount = Array.isArray(earn.items) ? earn.items.length : 0;
      next.push({
        rail: "wallet",
        name: "Earn",
        ok: Boolean(earn.ok) && earnCount > 0,
        detail:
          earn.ok && earnCount > 0
            ? `${earnCount} USDT earn pools on BNB Chain.`
            : earn.error || "No USDT earn pools came back.",
        raw: earn.ok ? { count: earnCount } : earn,
      });

      const pay = await fetch(
        `/api/venue/x402?ticker=${encodeURIComponent(ticker)}&amount=${encodeURIComponent(amount)}`,
      );
      const challenge = await pay.json();
      const b402Off =
        challenge?.code === "1160401" || challenge?.code === 1160401;
      next.push({
        rail: "pay",
        name: "Challenge",
        ok: pay.status === 402,
        detail:
          pay.status === 402
            ? "Asked for $0.05 USDT before serving the tape."
            : b402Off
              ? "B402 is not enabled on this API key, so the $0.05 request is not sent."
              : challenge?.error || `No payment request. HTTP ${pay.status}.`,
        raw: challenge,
      });

      next.push({
        rail: "pay",
        name: "Preview",
        ok: pay.status === 402,
        detail:
          pay.status === 402
            ? "The $0.05 request is ready for a buyer to sign."
            : "There is no payment request to preview until B402 is enabled.",
      });

      const studio = await fetch("/api/venue/studio").then((r) => r.json());
      next.push({
        rail: "seller",
        name: "Agent",
        ok: Boolean(studio.bag?.called || studio.agent?.ok),
        detail: studio.agent?.ok
          ? "The seller is up and answering."
          : studio.bag?.called
            ? "Studio is installed. Start the seller to take tape orders."
            : "The seller agent is not running on this site. Quotes still come from the desk.",
        raw: studio,
      });
    } catch (e) {
      next.push({
        rail: "seller",
        name: "Check",
        ok: false,
        detail: e instanceof Error ? e.message : "The check failed.",
      });
    }
    setRows(next);
    setLoading(false);
  }

  const ready = rows.filter((r) => r.ok).length;
  const meta = tickerMeta(ticker);
  const checked = rows.length > 0;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
        <h3 className="display text-3xl tracking-[-0.03em]">Tape</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
          Check the wallet, the $0.05 payment, and the agent that sells this
          tape for {meta.name}.
        </p>

        <label className="mt-6 block text-xs font-medium text-[var(--ink-soft)]">
          Name
          <span className="mt-1.5 flex items-center gap-2 rounded-2xl bg-[var(--bg-muted)] px-3">
            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white">
              <Image src={meta.logo} alt="" fill sizes="28px" className="object-contain p-0.5" />
            </span>
            <select
              className="h-11 w-full bg-transparent text-sm font-medium text-[var(--ink)] outline-none"
              value={CORE_TICKERS.includes(ticker) ? ticker : "NVDA"}
              onChange={(e) => setTicker(e.target.value)}
            >
              {CORE_TICKERS.map((t) => (
                <option key={t} value={t}>
                  {tickerMeta(t).name} · {t}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="mt-4 block text-xs font-medium text-[var(--ink-soft)]">
          Amount
          <span className="mt-1.5 flex h-11 items-center rounded-2xl bg-[var(--bg-muted)] px-3">
            <input
              className="w-full bg-transparent text-sm font-medium outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
            />
            <span className="text-xs text-[var(--ink-soft)]">USDT</span>
          </span>
        </label>
        <div className="mt-2 flex gap-2">
          {AMOUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(n)}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium",
                amount === n
                  ? "bg-[#111] text-white"
                  : "bg-[var(--bg-muted)] text-[var(--ink-soft)]",
              )}
            >
              ${n}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-[var(--bg-muted)] px-4 py-3 text-sm">
          <span className="text-[var(--ink-soft)]">Buyer pays</span>
          <span className="font-semibold">$0.05 USDT</span>
        </div>

        <button
          type="button"
          className="btn btn-primary mt-4 w-full"
          disabled={loading}
          onClick={run}
        >
          {loading ? "Checking…" : "Check tape"}
        </button>
        {checked && (
          <p className="mt-3 text-center text-sm text-[var(--ink-soft)]">
            {ready} of {rows.length} ready
          </p>
        )}
      </section>

      <div className="grid gap-3">
        {RAILS.map((rail) => {
          const steps = rows.filter((r) => r.rail === rail.id);
          const okCount = steps.filter((s) => s.ok).length;
          return (
            <section
              key={rail.id}
              className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-[17px] font-semibold">{rail.title}</h4>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{rail.body}</p>
                </div>
                <span
                  className={
                    !checked
                      ? "shrink-0 rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-xs font-medium text-[var(--ink-soft)]"
                      : okCount === steps.length
                        ? "shrink-0 rounded-full bg-[var(--signal-soft)] px-2.5 py-1 text-xs font-medium text-[var(--signal)]"
                        : "shrink-0 rounded-full bg-[#fdecee] px-2.5 py-1 text-xs font-medium text-[var(--danger)]"
                  }
                >
                  {!checked ? "Not checked" : okCount === steps.length ? "Ready" : "Blocked"}
                </span>
              </div>
              <ul className="mt-4 divide-y divide-black/[0.05]">
                {rail.steps.map((planned) => {
                  const step = steps.find((s) => s.name === planned.name);
                  return (
                    <li key={planned.name} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{planned.name}</span>
                        <span
                          className={
                            !step
                              ? "text-xs font-medium text-[var(--ink-soft)]"
                              : step.ok
                                ? "text-xs font-medium text-[var(--signal)]"
                                : "text-xs font-medium text-[var(--danger)]"
                          }
                        >
                          {!step ? "Waiting" : step.ok ? "Ready" : "Blocked"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {step?.detail || planned.hint}
                      </p>
                      {step?.raw != null && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-[var(--ink-soft)]">
                            Response
                          </summary>
                          <pre className="mt-2 max-h-36 overflow-auto text-[11px] text-[var(--ink-soft)]">
                            {JSON.stringify(step.raw, null, 2)}
                          </pre>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
