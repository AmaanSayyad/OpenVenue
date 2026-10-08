"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

const ITEMS = [
  { href: "/app?tab=explore", tab: "explore", label: "Explore" },
  { href: "/app?tab=trade", tab: "trade", label: "Trade" },
  { href: "/app?tab=portfolio", tab: "portfolio", label: "Portfolio" },
  { href: "/app?tab=watch", tab: "watch", label: "Watch" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  if (!pathname?.startsWith("/app")) return null;

  const tab = search.get("tab") || "explore";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/8 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-1">
        {ITEMS.map((item) => {
          const active = tab === item.tab;
          return (
            <li key={item.tab} className="flex-1">
              <Link
                href={item.href}
                className={clsx(
                  "flex flex-col items-center rounded-xl px-2 py-2 text-[11px] font-medium transition",
                  active
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--ink-soft)] hover:bg-[var(--bg-muted)]",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
