"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect } from "wagmi";
import "@/config/appkit";
import clsx from "clsx";
import { motion } from "framer-motion";
import { NavSearch } from "@/components/NavSearch";

const DESK_NAV = [
  { id: "explore", label: "Explore" },
  { id: "trade", label: "Trade" },
  { id: "portfolio", label: "Portfolio" },
  { id: "watch", label: "Watch" },
  { id: "orders", label: "Orders" },
  { id: "strategies", label: "Strategies" },
  { id: "park", label: "Park" },
  { id: "agent", label: "Agent" },
  { id: "tape", label: "Tape" },
] as const;

export function SiteHeader(props: {
  variant?: "auto" | "solid" | "dark" | "light";
  announce?: boolean;
  end?: ReactNode;
}) {
  return (
    <Suspense fallback={<SiteHeaderBar {...props} activeTab={null} onDesk={false} />}>
      <SiteHeaderBound {...props} />
    </Suspense>
  );
}

function SiteHeaderBound(props: {
  variant?: "auto" | "solid" | "dark" | "light";
  announce?: boolean;
  end?: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onDesk = pathname.startsWith("/app");
  const activeTab = onDesk ? searchParams.get("tab") || "explore" : null;
  return <SiteHeaderBar {...props} activeTab={activeTab} onDesk={onDesk} />;
}

function SiteHeaderBar({
  variant = "auto",
  announce = false,
  end,
  activeTab,
  onDesk,
}: {
  variant?: "auto" | "solid" | "dark" | "light";
  announce?: boolean;
  end?: ReactNode;
  activeTab: string | null;
  onDesk: boolean;
}) {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const short = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const mode =
    variant === "auto"
      ? scrolled
        ? "solid"
        : "light"
      : variant === "light"
        ? "light"
        : variant;

  const dark = mode === "dark";
  const light = mode === "light";
  const solid = mode === "solid";
  const showAnnounce = announce && !scrolled;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50">
      {showAnnounce && (
        <div className="pointer-events-auto border-b border-white/10 bg-[#111] px-4 py-2 text-center text-[13px] font-medium text-white/90">
          Session-aware routing across bStocks, Ondo, and xStocks on BNB Chain.{" "}
          <Link href="/app" className="underline underline-offset-2">
            Launch OpenVenue →
          </Link>
        </div>
      )}
      <div className="flex justify-center px-4 pt-3 sm:pt-4">
        <motion.header
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={clsx(
            "pointer-events-auto flex h-12 w-full max-w-[1440px] items-center gap-2 rounded-full px-3 sm:h-[52px] sm:gap-3 sm:px-3",
            "shadow-[var(--shadow-nav)] transition-colors duration-300",
            solid && "border border-black/[0.06] bg-white",
            dark && "border border-white/10 bg-[#111]",
            light && "border border-white/20 bg-white/10 backdrop-blur-xl",
          )}
        >
          <Link href="/" className="flex shrink-0 items-center gap-2 pl-1">
            <Image
              src="/brand/mark.svg"
              alt=""
              width={24}
              height={24}
              className={clsx((light || dark) && "invert")}
            />
            <span
              className={clsx(
                "text-[16px] font-medium tracking-[-0.02em]",
                light || dark ? "text-white" : "text-black",
              )}
            >
              OpenVenue
            </span>
          </Link>

          <nav
            className={clsx(
              "flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-[13px] font-medium",
              light || dark ? "text-white/85" : "text-black",
            )}
          >
            {DESK_NAV.map((item) => {
              const on = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={`/app?tab=${item.id}`}
                  className={clsx(
                    "shrink-0 rounded-full px-3 py-1.5 transition",
                    on &&
                      (light || dark
                        ? "bg-white text-black!"
                        : "bg-black text-white!"),
                    !on && "opacity-80 hover:opacity-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <NavSearch dark={light || dark} solid={solid} />

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {end}
            {isConnected ? (
              <button
                className="flex h-9 items-center gap-2 rounded-full bg-[#f2f2f2] py-1 pl-1.5 pr-3 text-[#111]"
                onClick={() => disconnect()}
              >
                <span className="relative h-7 w-7 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/logos/metamask.svg"
                    alt=""
                    className="h-7 w-7"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/logos/bnb.png"
                    alt=""
                    className="absolute -bottom-0.5 -right-1 h-3.5 w-3.5 rounded-full bg-white"
                  />
                </span>
                <span className="text-[14px] font-medium tracking-[-0.01em]">
                  {short}
                </span>
              </button>
            ) : (
              <button
                className={clsx(
                  "btn btn-sm",
                  light || dark
                    ? "border border-white/25 bg-white/10 text-white"
                    : "btn-ghost",
                )}
                onClick={() => open()}
              >
                Connect
              </button>
            )}
            {!onDesk && (
              <Link
                href="/app"
                className={clsx(
                  "btn btn-sm",
                  light || dark ? "btn-on-dark" : "btn-primary",
                )}
              >
                Launch App
              </Link>
            )}
          </div>
        </motion.header>
      </div>
    </div>
  );
}
