"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { DeskAlert } from "@/lib/venue/receipts";
import { markAlertsRead } from "@/lib/venue/receipts";

function plain(text: string) {
  return text
    .replace(/pre_market/gi, "pre-market")
    .replace(/after_hours/gi, "after hours")
    .replace(/(\d+(?:\.\d+)?) bps/gi, (_, n: string) => {
      const pct = Number(n) / 100;
      return `${pct.toFixed(2)}%`;
    })
    .replace(
      /Route ready under ([\d.]+)% - confirm execute\./i,
      "The quote is inside your limit. Confirm it on the trade ticket.",
    );
}

function kindLabel(kind: DeskAlert["kind"]) {
  if (kind === "session") return "Session";
  if (kind === "spread") return "Spread";
  if (kind === "price") return "Price";
  return "Desk";
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function AlertBell({
  alerts,
  onChange,
}: {
  alerts: DeskAlert[];
  onChange: (next: DeskAlert[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const unread = alerts.filter((a) => !a.read).length;

  const rows = useMemo(() => {
    const grouped: Array<DeskAlert & { count: number }> = [];
    for (const alert of alerts) {
      const prev = grouped.find(
        (row) => row.title === alert.title && row.body === alert.body,
      );
      if (prev) {
        prev.count += 1;
        if (!alert.read) prev.read = false;
        continue;
      }
      grouped.push({ ...alert, count: 1 });
    }
    return grouped.slice(0, 8);
  }, [alerts]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-alert-bell]")) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div className="relative" data-alert-bell>
      <button
        type="button"
        className="relative rounded-full bg-[var(--bg-muted)] px-3 py-2 text-sm font-medium ring-1 ring-black/5"
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread) onChange(markAlertsRead());
        }}
        aria-label="Alerts"
        aria-expanded={open}
      >
        Alerts
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-[22px] bg-white shadow-[0_16px_50px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06]">
          <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
            <p className="text-[15px] font-semibold">Alerts</p>
            <p className="text-xs text-[var(--ink-soft)]">
              {alerts.length === 0
                ? "None yet"
                : `${rows.length} ${rows.length === 1 ? "note" : "notes"}`}
            </p>
          </div>
          <ul className="max-h-80 overflow-y-auto px-2 pb-2">
            {rows.map((a) => (
              <li
                key={a.id}
                className={clsx(
                  "rounded-2xl px-3 py-3",
                  !a.read && "bg-[var(--bg-muted)]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-medium text-[var(--ink-soft)]">
                    {kindLabel(a.kind)}
                    {a.ticker ? ` · ${a.ticker}` : ""}
                    {a.count > 1 ? ` · ${a.count}` : ""}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--ink-soft)]">
                    {ago(a.at)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold leading-snug">
                  {plain(a.title)}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-[var(--ink-soft)]">
                  {plain(a.body)}
                </p>
              </li>
            ))}
            {alerts.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-[var(--ink-soft)]">
                Quotes, session changes, and strategy results show up here.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
