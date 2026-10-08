"use client";

import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const WRAPPERS = [
  {
    name: "bStocks",
    body: "On-chain pools that stay open when the US market is quiet.",
    logo: "/brand/logos/bnb.png",
  },
  {
    name: "Ondo",
    body: "Quoted trades, usually the deeper route while the US is open.",
    logo: "/brand/logos/ondo.svg",
  },
  {
    name: "xStocks",
    body: "The third wrapper for the same name, when it is listed.",
    logo: null,
  },
];

const STEPS = [
  {
    n: "01",
    t: "Session",
    d: "Check whether the US market is open, then choose on-chain pools or quote venues before asking for a price.",
  },
  {
    n: "02",
    t: "Discover",
    d: "Find every BNB Chain wrapper for that name: bStocks, Ondo, and xStocks.",
  },
  {
    n: "03",
    t: "Quote",
    d: "Price a pool swap and a quoted trade, across wrappers and sizes.",
  },
  {
    n: "04",
    t: "Simulate",
    d: "Dry-run the trade. If it would fail, it never reaches your wallet.",
  },
  {
    n: "05",
    t: "Park",
    d: "If nothing quotes, OpenVenue builds a deposit for idle USDT instead of leaving cash sitting.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#f7f7f7]">
      <SiteHeader variant="solid" />

      <div className="mx-auto max-w-5xl px-5 pb-6 pt-28">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div>
            <p className="text-sm font-medium text-[var(--ink-soft)]">How it works</p>
            <h1 className="display mt-2 text-4xl leading-[1.02] tracking-[-0.03em] sm:text-6xl">
              One name.
              <br />
              The wrapper that is open.
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-[var(--ink-soft)]">
              The same company can trade as a bStock, an Ondo token, or an
              xStock. OpenVenue picks the one that is live, checks the size, and
              only then asks you to sign.
            </p>
            <Link href="/app" className="btn btn-primary mt-6">
              Launch OpenVenue
            </Link>
          </div>

          <div className="grid gap-3">
            {WRAPPERS.map((wrapper) => (
              <div
                key={wrapper.name}
                className="flex items-center gap-4 rounded-[24px] bg-white px-5 py-4 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04]"
              >
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bg-muted)] text-sm font-semibold">
                  {wrapper.logo ? (
                    <Image
                      src={wrapper.logo}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-contain p-1.5"
                    />
                  ) : (
                    "x"
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{wrapper.name}</p>
                  <p className="mt-0.5 text-sm leading-snug text-[var(--ink-soft)]">
                    {wrapper.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ol className="mt-4 overflow-hidden rounded-[28px] bg-white shadow-[var(--shadow-card)] ring-1 ring-black/[0.04]">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className={
                i === 0
                  ? "grid gap-3 px-6 py-5 sm:grid-cols-[4.5rem_11rem_minmax(0,1fr)] sm:items-center sm:px-7"
                  : "grid gap-3 border-t border-black/[0.06] px-6 py-5 sm:grid-cols-[4.5rem_11rem_minmax(0,1fr)] sm:items-center sm:px-7"
              }
            >
              <span className="text-sm font-semibold text-[var(--ink-soft)]">{step.n}</span>
              <h2 className="display text-2xl tracking-[-0.03em]">{step.t}</h2>
              <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{step.d}</p>
            </li>
          ))}
        </ol>

        <section className="mt-4 rounded-[28px] bg-[#111] px-6 py-10 text-center text-white sm:px-10">
          <h2 className="display text-3xl tracking-[-0.03em] sm:text-4xl">
            The desk and the agent use the same path
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-white/70">
            Find a wrapper, check the size, simulate, then sign or park.
          </p>
          <Link href="/app" className="btn btn-on-dark mt-6">
            Launch OpenVenue
          </Link>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
