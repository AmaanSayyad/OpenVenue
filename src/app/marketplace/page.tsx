import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "OpenVenue Tape - Marketplace",
  description:
    "Pay $0.05 USDC on Monad for the best tokenized-stock venue recommendation.",
};

const FACTS = [
  { k: "Price", v: "$0.05", d: "Each time a buyer asks" },
  { k: "Paid in", v: "USDC", d: "On Monad Testnet / Mainnet" },
  { k: "Covers", v: "4 issuers", d: "Anchored, xStocks, Ondo*, bStocks*" },
];

const DELIVERS = [
  {
    t: "The best Monad venue",
    d: "Which issuer path wins for that ticker right now - live vs coming-soon clearly labeled.",
  },
  {
    t: "A live quote",
    d: "Out-amount, spread, session bias, and platform fee bps for the recommended route.",
  },
  {
    t: "A size check",
    d: "Whether that notional fits before anyone signs on Monad.",
  },
];

const STEPS = [
  "Connect a Monad wallet (Testnet or Mainnet).",
  "Hit /api/venue/x402 with a ticker.",
  "Pay $0.05 USDC via x402.",
  "Receive the best-venue JSON deliverable.",
  "Execute on the desk or from your agent.",
];

const NAMES = [
  { src: "/brand/logos/nvdaon.png", alt: "NVIDIA" },
  { src: "/brand/logos/aaplon.png", alt: "Apple" },
  { src: "/brand/logos/tslaon.png", alt: "Tesla" },
  { src: "/brand/logos/msfton.png", alt: "Microsoft" },
  { src: "/brand/logos/googlon.png", alt: "Alphabet" },
  { src: "/brand/logos/amznon.png", alt: "Amazon" },
];

export default function MarketplacePage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#f7f7f7]">
      <SiteHeader variant="solid" />
      <div className="mx-auto max-w-5xl px-5 pb-6 pt-28">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div>
            <p className="text-sm font-medium text-[var(--ink-soft)]">Marketplace</p>
            <h1 className="display mt-2 text-4xl leading-[1.02] tracking-[-0.03em] sm:text-6xl">
              OpenVenue Tape
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-[var(--ink-soft)]">
              Agents and desks pay ~$0.05 USDC on Monad via x402 and get the same
              flight-style venue recommendation the UI uses - which issuer to buy
              for NVDA (or any ticker) right now.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/app?tab=agent" className="btn btn-primary">
                Open Agent desk
              </Link>
              <Link href="/api/venue/x402?ticker=NVDA" className="btn btn-ghost">
                Try x402 challenge
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {FACTS.map((f) => (
              <div
                key={f.k}
                className="rounded-2xl border border-black/5 bg-white p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-soft)]">
                  {f.k}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{f.v}</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">{f.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {DELIVERS.map((d) => (
            <div
              key={d.t}
              className="rounded-2xl border border-black/5 bg-white p-5"
            >
              <h2 className="font-semibold">{d.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                {d.d}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          {NAMES.map((n) => (
            <span
              key={n.alt}
              className="relative h-12 w-12 overflow-hidden rounded-full border border-black/5 bg-white"
            >
              <Image src={n.src} alt={n.alt} fill className="object-cover" sizes="48px" />
            </span>
          ))}
        </div>

        <ol className="mt-12 space-y-3">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className="rounded-2xl border border-black/5 bg-white px-5 py-3 text-[15px]"
            >
              <span className="font-mono text-[var(--ink-soft)]">
                {String(i + 1).padStart(2, "0")}
              </span>{" "}
              {s}
            </li>
          ))}
        </ol>

        <p className="mt-6 text-sm text-[var(--ink-soft)]">
          * Ondo / bStocks show as coming-soon until they list on Monad; Anchored
          and xStocks are executable in the live registry.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
