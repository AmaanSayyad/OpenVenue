import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Venue Tape - Marketplace",
  description:
    "A $0.05 desk note: which tokenized-stock wrapper to use on BNB Chain right now.",
};

const FACTS = [
  { k: "Price", v: "$0.05", d: "Each time a buyer asks" },
  { k: "Paid in", v: "USDT", d: "On BNB Chain" },
  { k: "Covers", v: "3 wrappers", d: "bStocks, Ondo, xStocks" },
];

const DELIVERS = [
  {
    t: "The open wrapper",
    d: "Which of bStocks, Ondo, or xStocks is the one to use for that name right now.",
  },
  {
    t: "A live quote",
    d: "The price path for the size the buyer asked for, while the quote is still fresh.",
  },
  {
    t: "A size check",
    d: "Whether that amount fits the venue, before anyone signs.",
  },
];

const STEPS = [
  "Create a seller wallet for Venue Tape.",
  "Point it at this site.",
  "Register the agent so buyers can find it.",
  "Turn on the $0.05 payment.",
  "Publish the listing.",
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
              Venue Tape
            </h1>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[var(--ink-soft)]">
              A buyer asks which wrapper to use. Venue answers with the live
              route for that stock, for $0.05.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/app?tab=tape" className="btn btn-primary">
                Check the tape
              </Link>
              <Link href="/app" className="btn btn-ghost">
                Open the desk
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-2">
                {NAMES.map((name) => (
                  <Image
                    key={name.alt}
                    src={name.src}
                    alt={name.alt}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full bg-white object-cover ring-2 ring-[#f7f7f7]"
                  />
                ))}
              </div>
              <p className="text-sm text-[var(--ink-soft)]">NVIDIA, Apple, Tesla, and the rest of the desk</p>
            </div>
          </div>

          <article className="rounded-[28px] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--ink-soft)]">Sample reply</p>
              <span className="rounded-full bg-[var(--signal-soft)] px-2.5 py-1 text-xs font-medium text-[var(--signal)]">
                $0.05
              </span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Image
                src="/brand/logos/nvdaon.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-none">NVIDIA</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">NVDAon · $15</p>
              </div>
              <span className="ml-auto rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-xs font-medium">
                Pre-market
              </span>
            </div>
            <dl className="mt-6 divide-y divide-black/[0.06] text-sm">
              {[
                ["Use", "Ondo"],
                ["Why", "Quote venues are thin before the US open"],
                ["Size", "$15 fits this venue"],
                ["You pay", "0.05 USDT"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-6 py-3">
                  <dt className="shrink-0 text-[var(--ink-soft)]">{k}</dt>
                  <dd className="max-w-[14rem] text-right font-medium leading-snug">{v}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          {FACTS.map((fact) => (
            <div
              key={fact.k}
              className="rounded-[24px] bg-white px-5 py-4 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04]"
            >
              <p className="text-xs font-medium text-[var(--ink-soft)]">{fact.k}</p>
              <p className="display mt-1 text-2xl tracking-[-0.03em]">{fact.v}</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{fact.d}</p>
            </div>
          ))}
        </section>

        <section className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-[28px] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] sm:p-7">
            <h2 className="display text-2xl">What the buyer gets</h2>
            <ul className="mt-5 space-y-4">
              {DELIVERS.map((item) => (
                <li key={item.t}>
                  <p className="font-medium">{item.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{item.d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[28px] bg-[#111] p-6 text-white sm:p-7">
            <h2 className="display text-2xl">Before you publish</h2>
            <ol className="mt-5 space-y-3">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-white/80">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
      <SiteFooter compact />
    </main>
  );
}
