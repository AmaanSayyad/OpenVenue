"use client";

import clsx from "clsx";
import type { Hex } from "viem";
import {
  BSC_CHAIN_ID,
  chainLabel,
  explorerName,
  explorerTx,
  MONAD_MAINNET_ID,
} from "@/lib/monad/chains";

export function FillStatus({
  txHash,
  confirming,
  confirmed,
  failed,
  kind = "trade",
  summary,
  claimLater,
  chainId = MONAD_MAINNET_ID,
  onDismiss,
  className,
}: {
  txHash?: Hex;
  confirming?: boolean;
  confirmed?: boolean;
  failed?: boolean;
  kind?: "trade" | "park" | "unpark";
  summary?: string | null;
  claimLater?: boolean;
  chainId?: number;
  onDismiss?: () => void;
  className?: string;
}) {
  if (!txHash) return null;

  const short = `${txHash.slice(0, 6)}…${txHash.slice(-4)}`;
  const network = chainLabel(chainId);
  const explorer = explorerName(chainId);
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
        ? `Waiting for ${network}`
        : "Sent to the network";
  const body = failed
    ? kind === "trade"
      ? chainId === BSC_CHAIN_ID
        ? "BNB Chain did not include this swap (or it reverted). Raise size above dust, bump slippage, then resolve again."
        : "Monad did not include this transaction. Resolve again and sign before the quote expires."
      : `${network} did not include this transaction.`
    : confirmed
      ? kind === "park"
        ? summary
          ? `${summary.replace(" · ", " is earning in ")}.`
          : "USDC is earning on Monad."
        : kind === "unpark"
          ? claimLater
            ? `${summary || "This pool"} settles the USDC before it returns. Unpark again to claim it.`
            : summary
              ? `USDC from ${summary} is back in this wallet.`
              : "USDC is back in this wallet."
          : chainId === BSC_CHAIN_ID
            ? "Stock fill is on BNB Chain. Platform fee settles on Monad."
            : "The trade is on Monad."
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
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold leading-tight">{title}</p>
          {onDismiss && (failed || confirmed || confirming) && (
            <button
              type="button"
              className="shrink-0 text-xs font-medium text-[var(--ink-soft)] underline-offset-2 hover:underline"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{body}</p>
        <a
          className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--ink)]"
          href={explorerTx(chainId, txHash)}
          target="_blank"
          rel="noreferrer"
        >
          View on {explorer}
          <span className="font-normal text-[var(--ink-soft)]">{short}</span>
        </a>
      </div>
    </div>
  );
}
