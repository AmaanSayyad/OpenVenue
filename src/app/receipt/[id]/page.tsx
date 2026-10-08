"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { loadShareReceipt } from "@/lib/venue/shareReceipt";
import type { TradeReceipt } from "@/lib/venue/receipts";
import { kindLabel } from "@/lib/venue/types";
import type { WrapperKind } from "@/lib/venue/types";

export default function ShareReceiptPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [receipt, setReceipt] = useState<TradeReceipt | null>(null);

  useEffect(() => {
    setReceipt(loadShareReceipt(id));
  }, [id]);

  return (
    <main className="flex min-h-screen flex-col bg-[#f7f7f7]">
      <SiteHeader variant="solid" />
      <div className="mx-auto max-w-lg px-5 pb-4 pt-28">
        <p className="text-sm text-[var(--ink-soft)]">Shared receipt</p>
        {!receipt ? (
          <div className="mt-4 rounded-[24px] bg-white p-6 ring-1 ring-black/[0.06]">
            <h1 className="display text-2xl">Receipt not found</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              This share link is local to the device that created it. Open the
              desk Portfolio page and share again from that browser.
            </p>
            <Link href="/app" className="btn btn-primary mt-5 inline-flex">
              Open Venue
            </Link>
          </div>
        ) : (
          <div className="mt-4 rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-black/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--ink-soft)]">Venue receipt</p>
              <span
                className={
                  receipt.status === "confirmed"
                    ? "rounded-full bg-[var(--signal-soft)] px-2.5 py-1 text-xs font-medium text-[var(--signal)]"
                    : receipt.status === "failed"
                      ? "rounded-full bg-[#fdecee] px-2.5 py-1 text-xs font-medium text-[var(--danger)]"
                      : "rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-xs font-medium text-[var(--ink-soft)]"
                }
              >
                {receipt.status === "confirmed"
                  ? "Filled"
                  : receipt.status === "failed"
                    ? "Didn’t fill"
                    : "Submitted"}
              </span>
            </div>
            <h1 className="display mt-3 text-3xl">
              {receipt.side === "buy"
                ? "Buy"
                : receipt.side === "sell"
                  ? "Sell"
                  : receipt.side === "park"
                    ? "Park"
                    : "Approve"}{" "}
              {receipt.symbol || receipt.ticker}
            </h1>
            <dl className="mt-5 space-y-2.5 text-sm">
              {(
                [
                  ["Amount", receipt.amountLabel],
                  ["You receive", receipt.outAmountHuman || "—"],
                  [
                    "Wrapper",
                    receipt.wrapperKind
                      ? kindLabel(receipt.wrapperKind as WrapperKind)
                      : "—",
                  ],
                  ["Route", receipt.mode || "—"],
                  ["Venue", receipt.vendor || "—"],
                  [
                    "Session",
                    (receipt.sessionState || "—").replaceAll("_", " "),
                  ],
                  ["When", new Date(receipt.at).toLocaleString()],
                ] as Array<[string, string]>
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-[var(--ink-soft)]">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {receipt.txHash && (
              <a
                className="mt-5 block truncate rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-xs underline"
                href={
                  receipt.txHash.startsWith("0x")
                    ? `https://bscscan.com/tx/${receipt.txHash}`
                    : undefined
                }
                target="_blank"
                rel="noreferrer"
              >
                {receipt.txHash}
              </a>
            )}
            <Link href="/app?tab=trade" className="btn btn-primary mt-5 w-full">
              Trade on Venue
            </Link>
          </div>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
