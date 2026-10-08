"use client";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import type { TradeReceipt } from "@/lib/venue/receipts";
import { kindLabel } from "@/lib/venue/types";
import type { WrapperKind } from "@/lib/venue/types";
import { copyShareReceipt } from "@/lib/venue/shareReceipt";
import { VendorName } from "@/components/VendorMark";

const SESSION: Record<string, string> = {
  open: "Regular hours",
  pre_market: "Pre-market",
  after_hours: "After hours",
  closed: "Overnight",
  weekend: "Weekend",
};

function sessionLabel(state?: string) {
  if (!state) return "—";
  return SESSION[state] || state.replaceAll("_", " ");
}

function plainFailure(reason: string) {
  const lower = reason.toLowerCase();
  if (lower.includes("exceeds balance") || lower.includes("insufficient")) {
    return "This wallet doesn’t have enough of the token being spent.";
  }
  if (lower.includes("simulation gate")) {
    return "The simulation gate stopped the trade before it was sent.";
  }
  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "The wallet request was declined.";
  }
  if (lower.includes("quote expired")) {
    return "The quote expired before it could be sent.";
  }
  return "The trade did not go through.";
}

function headline(receipt: TradeReceipt) {
  const name = receipt.symbol || receipt.ticker;
  if (receipt.status === "failed") return `${name} didn’t fill`;
  if (receipt.status === "confirmed") {
    return receipt.side === "sell" ? `Sold ${name}` : `Bought ${name}`;
  }
  if (receipt.side === "sell") return `Selling ${name}`;
  if (receipt.side === "approve") return `Approved ${name}`;
  if (receipt.side === "park") return `Parked ${name}`;
  return `Buying ${name}`;
}

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: TradeReceipt | null;
  onClose: () => void;
}) {
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!receipt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [receipt, onClose]);

  if (!receipt) return null;

  async function share() {
    if (!receipt) return;
    const res = await copyShareReceipt(receipt);
    setShareMsg(
      res.shared
        ? "Shared"
        : `Copied · ${res.url.replace(/^https?:\/\//, "")}`,
    );
  }

  const failed = receipt.status === "failed";
  const confirmed = receipt.status === "confirmed";
  const sim =
    receipt.failReason?.toLowerCase().includes("simulation gate")
      ? "Blocked"
      : receipt.simOk == null
        ? "—"
        : receipt.simOk
          ? "Passed"
          : "Failed";

  const rows: Array<[string, ReactNode]> = [
    [
      "Wrapper",
      receipt.wrapperKind
        ? kindLabel(receipt.wrapperKind as WrapperKind)
        : "—",
    ],
    ["Mode", receipt.mode || "—"],
    ["Vendor", receipt.vendor ? <VendorName name={receipt.vendor} /> : "—"],
    ["Session", sessionLabel(receipt.sessionState)],
    ["Simulation", sim],
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
        className="w-full max-w-[420px] rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 text-[12px] font-semibold",
              failed && "bg-[#fdecee] text-[#c62828]",
              confirmed && "bg-[#e7f6ee] text-[#0b7a45]",
              !failed && !confirmed && "bg-[var(--bg-muted)] text-[var(--ink)]",
            )}
          >
            {failed ? "Failed" : confirmed ? "Filled" : "Submitted"}
          </span>
          <button
            type="button"
            className="text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <h3 id="receipt-title" className="display mt-4 text-[28px] leading-none tracking-tight">
          {headline(receipt)}
        </h3>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          {receipt.side === "sell" ? "Sell" : receipt.side === "buy" ? "Buy" : receipt.side}{" "}
          · {receipt.ticker}
        </p>

        <div className="mt-5 flex items-end justify-between gap-3 rounded-[18px] bg-[var(--bg-muted)] px-4 py-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--ink-soft)]">
              Amount
            </div>
            <div className="mt-1 text-[20px] font-semibold tabular-nums">
              {receipt.amountLabel}
            </div>
          </div>
          <div className="pb-1 text-[var(--ink-soft)]">→</div>
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--ink-soft)]">
              Est. out
            </div>
            <div className="mt-1 text-[20px] font-semibold tabular-nums">
              {receipt.outAmountHuman || "—"}
            </div>
          </div>
        </div>

        <dl className="mt-4">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 border-b border-black/[0.05] py-2.5 text-[14px]"
            >
              <dt className="text-[var(--ink-soft)]">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {receipt.failReason && (
          <div className="mt-4 rounded-[16px] bg-[#fdecee] px-4 py-3">
            <p className="text-sm font-medium text-[#9b1c1c]">
              {plainFailure(receipt.failReason)}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#9b1c1c]/80">
              {receipt.failReason}
            </p>
          </div>
        )}

        {receipt.txHash && (
          <a
            href={
              receipt.mode === "RFQ"
                ? undefined
                : `https://bscscan.com/tx/${receipt.txHash}`
            }
            target="_blank"
            rel="noreferrer"
            className={clsx(
              "mt-4 block truncate rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-xs",
              receipt.mode !== "RFQ" && "underline",
            )}
          >
            {receipt.txHash}
          </a>
        )}

        {(receipt.notes || []).length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--ink-soft)]">
            {receipt.notes!.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={share}>
            {shareMsg || "Share"}
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
