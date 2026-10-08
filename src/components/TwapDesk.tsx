"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import {
  loadDeskOrders,
  pushDeskOrder,
  updateDeskOrder,
  type DeskOrder,
  type DeskOrderKind,
} from "@/lib/venue/twap";
import { CORE_TICKERS, tickerMeta } from "@/lib/venue/tickers";

const HOURS = ["1", "4", "8"] as const;
const SLICES = ["4", "8", "12"] as const;
const SPREADS = ["5", "15", "30"] as const;

export function TwapDesk({
  defaultTicker,
  onActivateLimit,
}: {
  defaultTicker?: string;
  onActivateLimit?: (opts: {
    ticker: string;
    amountUsdt: number;
    maxSpreadBps: number;
  }) => void;
}) {
  const [orders, setOrders] = useState<DeskOrder[]>([]);
  const [kind, setKind] = useState<DeskOrderKind>("limit");
  const [ticker, setTicker] = useState(defaultTicker || "NVDA");
  const [amount, setAmount] = useState("50");
  const [limitBps, setLimitBps] = useState("15");
  const [hours, setHours] = useState("4");
  const [slices, setSlices] = useState("8");

  useEffect(() => {
    setOrders(loadDeskOrders());
  }, []);

  useEffect(() => {
    if (defaultTicker) setTicker(defaultTicker);
  }, [defaultTicker]);

  const amountUsdt = Number(amount);
  const amountOk = Number.isFinite(amountUsdt) && amountUsdt > 0;
  const bps = Number(limitBps) || 15;
  const hourN = Number(hours) || 4;
  const sliceN = Number(slices) || 8;
  const meta = tickerMeta(ticker);
  const sliceUsd = amountOk ? amountUsdt / sliceN : 0;
  const everyMin = Math.max(1, Math.round((hourN * 60) / sliceN));

  function create() {
    if (!amountOk) return;
    const next = pushDeskOrder({
      kind,
      ticker,
      side: "buy",
      amountUsdt,
      limitSpreadBps: kind === "limit" ? bps : undefined,
      durationHours: kind === "twap" ? hourN : undefined,
      slices: kind === "twap" ? sliceN : undefined,
      note:
        kind === "limit"
          ? `Buy if the spread is ${bps} bps or tighter`
          : `${sliceN} buys of about $${sliceUsd.toFixed(2)} across ${hourN}h`,
    });
    setOrders(next);
    if (kind === "limit" && onActivateLimit) {
      onActivateLimit({
        ticker,
        amountUsdt,
        maxSpreadBps: bps,
      });
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
        <h3 className="display text-2xl">Place an order</h3>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          A limit waits for a tight spread. A TWAP splits the same buy across
          the session. Both stay on this desk.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <KindCard
            active={kind === "limit"}
            title="Limit"
            body="Buy only when the quote is close to the reference price."
            onClick={() => setKind("limit")}
          />
          <KindCard
            active={kind === "twap"}
            title="TWAP"
            body="Split the amount into smaller buys over a few hours."
            onClick={() => setKind("twap")}
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-[var(--ink-soft)]">
            Name
            <span className="mt-1.5 flex items-center gap-2 rounded-2xl bg-[var(--bg-muted)] px-3">
              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white">
                <Image src={meta.logo} alt="" fill sizes="28px" className="object-contain p-0.5" />
              </span>
              <select
                className="h-11 w-full bg-transparent text-sm font-medium text-[var(--ink)] outline-none"
                value={ticker}
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
          <label className="text-xs font-medium text-[var(--ink-soft)]">
            Amount
            <span className="mt-1.5 flex h-11 items-center rounded-2xl bg-[var(--bg-muted)] px-3">
              <input
                className="w-full bg-transparent text-sm font-medium text-[var(--ink)] outline-none"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
              <span className="shrink-0 text-xs text-[var(--ink-soft)]">USDT</span>
            </span>
          </label>
        </div>

        {kind === "limit" ? (
          <div className="mt-4">
            <div className="text-xs font-medium text-[var(--ink-soft)]">
              How close to the reference price
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SPREADS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLimitBps(s)}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-sm font-medium",
                    limitBps === s
                      ? "bg-[var(--ink)] text-white"
                      : "bg-[var(--bg-muted)] text-[var(--ink-soft)]",
                  )}
                >
                  {s} bps · {(Number(s) / 100).toFixed(2)}%
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs font-medium text-[var(--ink-soft)]">
                Over
              </div>
              <div className="mt-2 flex gap-2">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className={clsx(
                      "rounded-full px-3 py-1.5 text-sm font-medium",
                      hours === h
                        ? "bg-[var(--ink)] text-white"
                        : "bg-[var(--bg-muted)] text-[var(--ink-soft)]",
                    )}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-[var(--ink-soft)]">
                Split into
              </div>
              <div className="mt-2 flex gap-2">
                {SLICES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlices(s)}
                    className={clsx(
                      "rounded-full px-3 py-1.5 text-sm font-medium",
                      slices === s
                        ? "bg-[var(--ink)] text-white"
                        : "bg-[var(--bg-muted)] text-[var(--ink-soft)]",
                    )}
                  >
                    {s} buys
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-[var(--bg-muted)] px-4 py-3 text-sm">
          {kind === "limit" ? (
            <p>
              Buy{" "}
              <span className="font-semibold">
                {amountOk ? `$${amountUsdt}` : "—"} of {meta.name}
              </span>{" "}
              when the spread is {bps} bps ({(bps / 100).toFixed(2)}%) or
              tighter, then open the trade ticket.
            </p>
          ) : (
            <p>
              About{" "}
              <span className="font-semibold">
                ${sliceUsd.toFixed(2)} every {everyMin} min
              </span>{" "}
              · {sliceN} buys of {meta.name} across {hourN} hours.
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary mt-4 w-full"
          disabled={!amountOk}
          onClick={create}
        >
          {kind === "limit" ? "Arm limit and open ticket" : "Save TWAP plan"}
        </button>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="display text-2xl">Open orders</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Pause or cancel without leaving the desk.
            </p>
          </div>
          <span className="text-xs text-[var(--ink-soft)]">
            {orders.filter((o) => o.status === "active").length} active
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-[var(--bg-muted)] px-5 py-10 text-center">
            <p className="font-medium">No orders yet</p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              A limit or TWAP you create shows up here.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-black/[0.05]">
            {orders.map((o) => {
              const m = tickerMeta(o.ticker);
              const d = new Date(o.createdAt);
              return (
                <li key={o.id} className="flex items-start gap-3 py-3.5">
                  <span className="relative mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <Image
                      src={m.logo}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-contain p-1"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {o.kind === "limit" ? "Limit" : "TWAP"} · {m.name}
                      </span>
                      <StatusPill status={o.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
                      ${o.amountUsdt} USDT
                      {o.kind === "limit" && o.limitSpreadBps != null
                        ? ` · within ${o.limitSpreadBps} bps`
                        : ""}
                      {o.kind === "twap" && o.slices
                        ? ` · ${o.slices} buys over ${o.durationHours}h`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                      {d.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      {d.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {o.status === "active" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="rounded-full px-3 py-1 text-xs font-medium ring-1 ring-black/10 hover:bg-[var(--bg-muted)]"
                          onClick={() =>
                            setOrders(updateDeskOrder(o.id, { status: "paused" }))
                          }
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          className="rounded-full px-3 py-1 text-xs font-medium text-[var(--danger)] ring-1 ring-black/10 hover:bg-[#fdecee]"
                          onClick={() =>
                            setOrders(
                              updateDeskOrder(o.id, { status: "cancelled" }),
                            )
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {o.status === "paused" && (
                      <button
                        type="button"
                        className="mt-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-black/10 hover:bg-[var(--bg-muted)]"
                        onClick={() =>
                          setOrders(updateDeskOrder(o.id, { status: "active" }))
                        }
                      >
                        Resume
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function KindCard({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-2xl px-4 py-4 text-left ring-1 transition",
        active
          ? "bg-[var(--ink)] text-white ring-[var(--ink)]"
          : "bg-[var(--bg-muted)] text-[var(--ink)] ring-transparent hover:ring-black/10",
      )}
    >
      <div className="text-[15px] font-semibold">{title}</div>
      <p
        className={clsx(
          "mt-1 text-[13px] leading-snug",
          active ? "text-white/75" : "text-[var(--ink-soft)]",
        )}
      >
        {body}
      </p>
    </button>
  );
}

function StatusPill({ status }: { status: DeskOrder["status"] }) {
  const label =
    status === "active"
      ? "Active"
      : status === "paused"
        ? "Paused"
        : status === "filled"
          ? "Filled"
          : "Cancelled";
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "active" && "bg-[var(--signal-soft)] text-[var(--signal)]",
        status === "paused" && "bg-[#fff6e5] text-[#9a6700]",
        status === "filled" && "bg-[var(--signal-soft)] text-[var(--signal)]",
        status === "cancelled" && "bg-[var(--bg-muted)] text-[var(--ink-soft)]",
      )}
    >
      {label}
    </span>
  );
}
