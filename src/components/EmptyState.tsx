"use client";

import clsx from "clsx";

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  className,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-[24px] bg-[var(--bg-muted)] px-6 py-10 text-center",
        className,
      )}
    >
      <h3 className="display text-xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--ink-soft)]">{body}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary mt-5" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorBanner({
  message,
  onDismiss,
  onRetry,
  tone = "danger",
}: {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  tone?: "danger" | "warn";
}) {
  return (
    <div
      className={clsx(
        "mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ring-1",
        tone === "warn"
          ? "bg-[var(--warn-soft)] text-[var(--ink)] ring-black/10"
          : "bg-[var(--warn-soft)] text-[var(--danger)] ring-[var(--danger)]/15",
      )}
    >
      <p className="min-w-0 flex-1 leading-snug">{message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={onRetry}>
            Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
