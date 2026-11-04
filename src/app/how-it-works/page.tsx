"use client";

import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const WRAPPERS = [
  {
    name: "Anchored",
    body: "Already live on Monad - multi-chain ERC-20 stocks in the compare grid today.",
    logo: "/brand/logos/monad.svg",
  },
  {
    name: "xStocks",
    body: "Native Monad issuance - first-class 24/7 venue on Testnet & Mainnet.",
    logo: "/brand/logos/xstocks.svg",
  },
  {
    name: "Ondo",
    body: "Reserved slot - appears the moment Ondo lists tokenized stocks on Monad.",
    logo: "/brand/logos/ondo.svg",
  },
  {
    name: "bStocks",
    body: "Reserved slot - plugs into the same aggregator when bStocks lands on Monad.",
    logo: "/brand/logos/monad.svg",
  },
];

const STEPS = [
  {
    n: "01",
    t: "Search",
    d: "Enter a ticker (NVDA, AAPL, …). OpenVenue loads every registered Monad issuer for that name.",
  },
  {
    n: "02",
    t: "Compare",
    d: "Flight-style ranking: spread, hours, liquidity, out-amount, and session fit - best path on top.",
  },
  {
    n: "03",
    t: "Quote",
    d: "Live quotes for Monad-ready venues. Coming-soon issuers stay visible but not executable yet.",
  },
  {
    n: "04",
    t: "Execute",
    d: "One click buys on the winning venue. You sign with a Monad wallet (Testnet or Mainnet).",
  },
  {
    n: "05",
    t: "Fee",
    d: "OpenVenue takes a small platform fee in USDC on Monad - home-base monetization for the desk.",
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
              Every Monad venue.
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-[var(--ink-soft)]">
              Tokenized stocks are fragmented across issuers. OpenVenue is the
              flight aggregator for Monad: compare Anchored, xStocks, and future
              Ondo / bStocks listings, then execute the best path. Fees settle
              in USDC on Monad only - no other chains.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/app" className="btn btn-primary">
                Launch OpenVenue
              </Link>
              <Link href="/app?tab=explore&tour=1" className="btn btn-ghost">
                Take the guide
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {WRAPPERS.map((w) => (
              <div
                key={w.name}
                className="rounded-2xl border border-black/5 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="relative h-9 w-9 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <Image src={w.logo} alt="" fill className="object-cover" sizes="36px" />
                  </span>
                  <p className="font-semibold">{w.name}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                  {w.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <ol className="mt-14 space-y-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-2xl border border-black/5 bg-white px-5 py-4 sm:flex sm:items-start sm:gap-6"
            >
              <span className="font-mono text-sm text-[var(--ink-soft)]">{s.n}</span>
              <div>
                <h2 className="text-lg font-semibold">{s.t}</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  {s.d}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-3xl bg-[var(--ink)] px-6 py-10 text-white sm:px-10">
          <h2 className="display text-3xl tracking-[-0.03em] sm:text-4xl">
            The desk and the agent use the same path
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/65">
            Search → compare → quote → execute on Monad. Agents can buy the same
            recommendation over x402 for ~$0.05 USDC.
          </p>
          <Link href="/app" className="btn btn-primary mt-6 inline-flex">
            Launch OpenVenue
          </Link>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
