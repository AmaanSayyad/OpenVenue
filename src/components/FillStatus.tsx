"use client";

import clsx from "clsx";
import type { Hex } from "viem";

export function FillStatus({
  txHash,
  confirming,
  confirmed,
  className,
}: {
  txHash?: Hex;
  confirming?: boolean;
  confirmed?: boolean;
  className?: string;
}) {
  if (!txHash) return null;

  return (
    <div
      className={clsx(
        "rounded-2xl px-4 py-3 text-sm ring-1",
        confirmed
          ? "bg-[var(--signal-soft)] text-[var(--signal)] ring-[var(--signal)]/20"
          : confirming
            ? "bg-[#fff8e6] text-[#8a5a00] ring-[#e6c35c]/40"
            : "bg-[var(--bg-muted)] text-[var(--ink)] ring-black/5",
        className,
      )}
    >
      <div className="font-semibold">
        {confirmed
          ? "Fill confirmed on BSC"
          : confirming
            ? "Confirming fill…"
            : "Submitted - waiting for confirmation"}
      </div>
      <p className="mt-1 opacity-90">
        {confirmed
          ? "Receipt marked confirmed. Cost basis / PnL updated."
          : "Polling the chain for inclusion. Keep this tab open."}
      </p>
      <a
        className="mt-2 inline-block underline"
        href={`https://bscscan.com/tx/${txHash}`}
        target="_blank"
        rel="noreferrer"
      >
        {txHash.slice(0, 10)}…{txHash.slice(-6)}
      </a>
    </div>
  );
}
