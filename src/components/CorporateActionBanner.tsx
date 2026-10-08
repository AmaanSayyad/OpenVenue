"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type Action = {
  code: string | null;
  label: string;
  message: string | null;
  openState: boolean;
};

export function CorporateActionBanner({
  ticker,
  contract,
  className,
}: {
  ticker: string;
  contract?: string | null;
  className?: string;
}) {
  const [action, setAction] = useState<Action | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ ticker });
    if (contract) qs.set("contract", contract);
    fetch(`/api/venue/asset-status?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setAction(d.action || null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ticker, contract]);

  if (!action) return null;

  const pause = action.code === "ASSET_PAUSED" || action.code === "MARKET_PAUSED";

  return (
    <div
      className={clsx(
        "rounded-2xl px-4 py-3 text-sm ring-1",
        pause
          ? "bg-[#fdeced] text-[var(--danger)] ring-[var(--danger)]/15"
          : "bg-[#fff8e6] text-[#8a5a00] ring-[#e6c35c]/40",
        className,
      )}
    >
      <div className="font-semibold">
        {pause ? "Trading paused" : "Trading limited"} - {action.label}
      </div>
      <p className="mt-1 opacity-90">
        {action.message
          ? `Corporate action: ${action.label} (${action.message}).`
          : `${action.label} may restrict RFQ / AMM fills for ${ticker}.`}{" "}
        OpenVenue will prefer wrappers that still quote, or park USDT if none.
      </p>
    </div>
  );
}
