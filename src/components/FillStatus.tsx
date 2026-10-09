"use client";

import clsx from "clsx";
import type { Hex } from "viem";

export function FillStatus({
  txHash,
  confirming,
  confirmed,
  failed,
  kind = "trade",
  summary,
  claimLater,
  className,
}: {
  txHash?: Hex;
  confirming?: boolean;
  confirmed?: boolean;
  failed?: boolean;
  kind?: "trade" | "park" | "unpark";
  summary?: string | null;
  claimLater?: boolean;
  className?: string;
}) {
  if (!txHash) return null;

  const short = `${txHash.slice(0, 6)}…${txHash.slice(-4)}`;
  const title = failed
    ? kind === "park"
      ? "Park did not land"
      : kind === "unpark"
        ? "Unpark did not land"
        : "Trade failed"
    : confirmed
      ? kind === "park"
        ? "Parked"
        : kind === "unpark"
          ? claimLater
            ? "Withdrawal requested"
            : "Unparked"
          : "Filled"
      : confirming
        ? "Waiting for BSC"
        : "Sent to the network";
  const body = failed
    ? kind === "trade"
      ? "BSC did not include this transaction. Resolve again and sign before the quote expires."
      : "BSC did not include this transaction."
    : confirmed
      ? kind === "park"
        ? summary
          ? `${summary.replace(" · ", " is earning in ")}.`
          : "USDT is earning on BNB Chain."
        : kind === "unpark"
          ? claimLater
            ? `${summary || "This pool"} settles the USDT before it returns. Unpark again to claim it.`
            : summary
              ? `USDT from ${summary} is back in this wallet.`
              : "USDT is back in this wallet."
          : "The trade is on BSC."
      : "This usually lands in a few seconds.";

  return (
    <div
      className={clsx(
        "flex items-start gap-3 rounded-[22px] bg-white px-4 py-4 ring-1 ring-black/[0.06]",
        className,
      )}
    >
      <span
        className={clsx(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          failed
            ? "bg-[#fde8e8] text-[#9b1c1c]"
            : confirmed
              ? "bg-[var(--signal-soft)] text-[var(--signal)]"
              : "bg-[#fff6d8] text-[#8a5a00]",
        )}
        aria-hidden
      >
        {failed ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M7 7l10 10M17 7L7 17" strokeLinecap="round" />
          </svg>
        ) : confirmed ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12.5l4.2 4.2L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">{title}</p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{body}</p>
        <a
          className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--ink)]"
          href={`https://bscscan.com/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          View on BscScan
          <span className="font-normal text-[var(--ink-soft)]">{short}</span>
        </a>
      </div>
    </div>
  );
}
