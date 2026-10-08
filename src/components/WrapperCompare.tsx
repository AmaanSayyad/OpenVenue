"use client";

import clsx from "clsx";
import Image from "next/image";
import { tickerMeta } from "@/lib/venue/tickers";
import { VendorName } from "@/components/VendorMark";
import { kindLabel, type VenueDecision, type WrapperKind } from "@/lib/venue/types";

function issuerLogo(kind: WrapperKind) {
  if (kind === "bstock") return "/brand/logos/bnb.png";
  if (kind === "ondo") return "/brand/logos/ondo.svg";
  return "/brand/mark.svg";
}

type QuoteRow = VenueDecision["quotes"][number];

function fmt(n: number | null | undefined) {
  if (n == null) return "-";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function WrapperCompare({
  quotes,
  selectedId,
  onSelect,
}: {
  quotes: QuoteRow[];
  selectedId?: string | null;
  onSelect: (quoteId: string) => void;
}) {
  if (!quotes.length) return null;

  return (
    <div className="overflow-x-auto rounded-[22px] bg-white ring-1 ring-black/[0.05]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/5 text-[var(--ink-soft)]">
            <th className="px-4 py-3 font-medium">Wrapper</th>
            <th className="px-4 py-3 font-medium">Mode</th>
            <th className="px-4 py-3 font-medium">On-chain</th>
            <th className="px-4 py-3 font-medium">Spread</th>
            <th className="px-4 py-3 font-medium">Est. out</th>
            <th className="px-4 py-3 font-medium">Vendor</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const m = tickerMeta(q.candidate.symbol);
            const active =
              q.route?.quoteId && q.route.quoteId === selectedId;
            return (
              <tr
                key={q.candidate.contractAddress}
                className={clsx(
                  "border-b border-black/[0.04] last:border-0 transition",
                  q.ok ? "cursor-pointer hover:bg-[var(--bg-muted)]/60" : "opacity-55",
                  active && "bg-[var(--signal-soft)]/40",
                )}
                onClick={() => {
                  if (q.ok && q.route) onSelect(q.route.quoteId);
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="relative h-11 w-11 shrink-0">
                      <span className="relative block h-11 w-11 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <Image src={m.logo} alt="" fill className="object-cover" sizes="44px" />
                      </span>
                      <span className="absolute -bottom-0.5 -right-1 h-[18px] w-[18px] overflow-hidden rounded-full bg-white ring-2 ring-white">
                        <Image
                          src={issuerLogo(q.candidate.kind)}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="18px"
                        />
                      </span>
                    </span>
                    <div>
                      <div className="font-semibold">
                        {kindLabel(q.candidate.kind)}
                      </div>
                      <div className="mono text-xs text-[var(--ink-soft)]">
                        {q.candidate.symbol}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs">
                    {q.route?.executionMode || (q.ok ? "-" : "No quote")}
                  </span>
                </td>
                <td className="px-4 py-3 mono">
                  {fmt(q.candidate.onChainPrice)}
                </td>
                <td className="px-4 py-3 mono">
                  {q.candidate.spreadBps == null
                    ? "-"
                    : `${q.candidate.spreadBps.toFixed(1)} bps`}
                </td>
                <td className="px-4 py-3 font-medium">
                  {q.outAmountHuman || "-"}
                </td>
                <td className="px-4 py-3 text-[var(--ink-soft)]">
                  {q.route?.vendorName ? (
                    <VendorName name={q.route.vendorName} />
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
