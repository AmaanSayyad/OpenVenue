"use client";

import Image from "next/image";
import clsx from "clsx";
import { formatEther } from "viem";
import { useGasPrice } from "wagmi";
import type { QuoteRoute } from "@/lib/venue/types";

function bnbFee(gasUnits: number, gasPrice: bigint) {
  const wei = BigInt(Math.round(gasUnits)) * gasPrice;
  const bnb = Number(formatEther(wei));
  if (!Number.isFinite(bnb) || bnb <= 0) return "Paid in BNB";
  if (bnb < 0.000001) return `~${bnb.toExponential(1)} BNB`;
  const text = bnb.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return `~${text} BNB`;
}

export function FeePreview({
  route,
  className,
}: {
  amountUsdt?: number;
  route: QuoteRoute | null | undefined;
  outHuman?: string | null;
  className?: string;
}) {
  const { data: gasPrice } = useGasPrice();

  if (!route) return null;

  const gasRaw = route.estimateGasFee ? Number(route.estimateGasFee) : null;
  const impact = route.priceImpactPercent
    ? Number(route.priceImpactPercent)
    : null;
  // Quotes return a gas limit (250000), not a dollar amount. Convert with the live BNB gas price.
  const gasLabel =
    gasRaw == null || !Number.isFinite(gasRaw)
      ? "Paid in BNB"
      : gasRaw < 1000
        ? `~$${gasRaw.toFixed(2)}`
        : gasPrice
          ? bnbFee(gasRaw, gasPrice)
          : "Paid in BNB";

  return (
    <div
      className={clsx(
        "rounded-2xl bg-[var(--bg-muted)] px-4 py-3 text-sm",
        className,
      )}
    >
      <dl className="space-y-2">
        <Row label="Network fee" value={gasLabel} logo="/brand/logos/bnb.png" />
        <Row
          label="Price impact"
          value={
            impact != null && Number.isFinite(impact)
              ? `${impact.toFixed(2)}%`
              : "—"
          }
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  logo,
}: {
  label: string;
  value: string;
  logo?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--ink-soft)]">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right font-medium tabular-nums whitespace-nowrap">
        {logo && (
          <span className="relative h-4 w-4 overflow-hidden rounded-full">
            <Image src={logo} alt="" fill className="object-cover" sizes="16px" />
          </span>
        )}
        {value}
      </dd>
    </div>
  );
}
