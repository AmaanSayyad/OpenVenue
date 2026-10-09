"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export const QUOTE_TTL_MS = 30_000;

export function quoteExpired(quoteAge: number | null, now: number) {
  if (quoteAge == null) return true;
  return now - quoteAge > QUOTE_TTL_MS;
}

export function QuoteExpiry({
  quoteAge,
  onExpire,
  className,
}: {
  quoteAge: number | null;
  onExpire?: () => void;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(false);

  useEffect(() => {
    notified.current = false;
    if (quoteAge == null) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next - quoteAge > QUOTE_TTL_MS) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [quoteAge]);

  useEffect(() => {
    if (quoteAge == null || !onExpire || notified.current) return;
    if (now - quoteAge <= QUOTE_TTL_MS) return;
    notified.current = true;
    onExpire();
  }, [now, quoteAge, onExpire]);

  if (quoteAge == null) return null;
  const left = Math.max(0, QUOTE_TTL_MS - (now - quoteAge));
  const secs = Math.ceil(left / 1000);
  const expired = left <= 0;
  const urgent = secs <= 8 && !expired;

  return (
    <p
      className={clsx(
        "text-center text-xs font-medium tabular-nums",
        expired && "text-[var(--danger)]",
        urgent && "text-[#8a5a00]",
        !expired && !urgent && "text-[var(--ink-soft)]",
        className,
      )}
    >
      {expired ? "Quote expired. Refresh before you trade." : `Quote good for ${secs}s`}
    </p>
  );
}
