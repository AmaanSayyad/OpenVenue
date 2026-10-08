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
}: {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-[var(--warn-soft)] px-4 py-3 text-sm text-[var(--danger)] ring-1 ring-[var(--danger)]/15">
      <p className="min-w-0 flex-1">{message}</p>
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
