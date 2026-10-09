"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import clsx from "clsx";

const PRIMARY = [
  { href: "/app?tab=explore", tab: "explore", label: "Explore" },
  { href: "/app?tab=trade", tab: "trade", label: "Trade" },
  { href: "/app?tab=portfolio", tab: "portfolio", label: "Portfolio" },
  { href: "/app?tab=park", tab: "park", label: "Park" },
] as const;

const MORE = [
  { href: "/app?tab=watch", tab: "watch", label: "Watch" },
  { href: "/app?tab=orders", tab: "orders", label: "Orders" },
  { href: "/app?tab=strategies", tab: "strategies", label: "Strategies" },
  { href: "/app?tab=agent", tab: "agent", label: "Agent" },
  { href: "/app?tab=tape", tab: "tape", label: "Tape" },
] as const;

export function MobileBottomNav() {
  return (
    <Suspense fallback={null}>
      <MobileBottomNavInner />
    </Suspense>
  );
}

function MobileBottomNavInner() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const tab = search.get("tab") || "explore";
  const onDesk = pathname?.startsWith("/app") ?? false;

  useEffect(() => {
    setMoreOpen(false);
  }, [tab, pathname]);

  if (!onDesk) return null;

  const moreActive = MORE.some((item) => item.tab === tab);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/8 bg-white/95 px-2 pt-1.5 backdrop-blur lg:hidden pb-[max(0.4rem,env(safe-area-inset-bottom))]">
      {moreOpen ? (
        <div className="mb-1 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--bg-muted)] p-1.5">
          {MORE.map((item) => (
            <Link
              key={item.tab}
              href={item.href}
              className={clsx(
                "rounded-xl px-3 py-2.5 text-center text-sm font-medium",
                tab === item.tab
                  ? "bg-[var(--ink)] text-white"
                  : "bg-white text-[var(--ink)]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
        {PRIMARY.map((item) => {
          const active = tab === item.tab;
          return (
            <li key={item.tab} className="flex-1">
              <Link
                href={item.href}
                className={clsx(
                  "flex items-center justify-center rounded-xl px-1 py-2.5 text-[12px] font-medium transition",
                  active
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--ink-soft)]",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={clsx(
              "flex w-full items-center justify-center rounded-xl px-1 py-2.5 text-[12px] font-medium transition",
              moreActive || moreOpen
                ? "bg-[var(--ink)] text-white"
                : "text-[var(--ink-soft)]",
            )}
          >
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
