"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FadeUp, ScaleIn, Stagger, StaggerItem } from "@/components/Motion";
import { Sparkline } from "@/components/Sparkline";

const TAPE = [
  { s: "SPYon", n: "S&P 500", p: "$582.10", d: "+0.12%", dp: "$0.70", logo: "/brand/logos/spyon.png" },
  { s: "MSFTon", n: "Microsoft", p: "$428.90", d: "+0.09%", dp: "$0.39", logo: "/brand/logos/msfton.png" },
  { s: "GOOGLB", n: "Alphabet", p: "$178.45", d: "+0.15%", dp: "$0.27", logo: "/brand/logos/googlon.png" },
  { s: "NVDAon", n: "NVIDIA", p: "$235.51", d: "+0.35%", dp: "$0.82", logo: "/brand/logos/nvdaon.png" },
  { s: "AAPLon", n: "Apple", p: "$258.12", d: "+0.22%", dp: "$0.57", logo: "/brand/logos/aaplon.png" },
  { s: "TSLAon", n: "Tesla", p: "$248.40", d: "-0.31%", dp: "$0.77", logo: "/brand/logos/tslaon.png" },
  { s: "AMZNon", n: "Amazon", p: "$223.62", d: "+0.29%", dp: "$0.65", logo: "/brand/logos/amznon.png" },
  { s: "METAB", n: "Meta", p: "$612.05", d: "-0.42%", dp: "$2.58", logo: "/brand/logos/metaon.png" },
];

const RAILS = [
  { src: "/brand/partners/apps/binance.svg", alt: "Binance" },
  { src: "/brand/partners/apps/bitget-wallet.svg", alt: "Bitget Wallet" },
  { src: "/brand/partners/apps/gate.svg", alt: "Gate" },
  { src: "/brand/partners/apps/metamask.svg", alt: "MetaMask" },
  { src: "/brand/partners/apps/trust-wallet.svg", alt: "Trust Wallet" },
  { src: "/brand/partners/apps/okx.svg", alt: "OKX" },
  { src: "/brand/partners/apps/binance-wallet.svg", alt: "Binance Wallet" },
  { src: "/brand/partners/apps/chainlink.svg", alt: "Chainlink" },
  { src: "/brand/partners/apps/blockchain-com.svg", alt: "Blockchain.com" },
  { src: "/brand/partners/apps/mexc.svg", alt: "MEXC" },
  { src: "/brand/partners/apps/1inch.svg", alt: "1inch" },
  { src: "/brand/partners/apps/cow.svg", alt: "CoW DAO" },
  { src: "/brand/partners/apps/alpaca.svg", alt: "Alpaca" },
  { src: "/brand/partners/apps/layer-zero.svg", alt: "LayerZero" },
  { src: "/brand/partners/apps/morpho.svg", alt: "Morpho" },
  { src: "/brand/partners/apps/gauntlet.svg", alt: "Gauntlet" },
  { src: "/brand/partners/apps/bit-go.svg", alt: "BitGo" },
  { src: "/brand/partners/apps/fireblocks.svg", alt: "Fireblocks" },
  { src: "/brand/partners/apps/ledger.svg", alt: "Ledger" },
  { src: "/brand/partners/apps/zodia.svg", alt: "Zodia" },
  { src: "/brand/partners/apps/bitget-cex.svg", alt: "Bitget" },
  { src: "/brand/partners/apps/coingecko.svg", alt: "CoinGecko" },
  { src: "/brand/partners/apps/coinmarketcap.svg", alt: "CoinMarketCap" },
  { src: "/brand/partners/apps/rwa.svg", alt: "rwa.xyz" },
  { src: "/brand/partners/apps/dune.svg", alt: "Dune" },
  { src: "/brand/partners/apps/pancakeswap.svg", alt: "PancakeSwap" },
];

const PARTNERS: { src: string; alt: string; mark?: string }[] = [
  { src: "/brand/partners/p1.svg?v=4", alt: "BlackRock" },
  { src: "/brand/partners/p2.svg?v=4", alt: "BNB Chain", mark: "/brand/logos/bnb.png" },
  { src: "/brand/partners/p3.svg?v=4", alt: "Binance", mark: "/brand/logos/bnb.png" },
  { src: "/brand/partners/p4.svg?v=4", alt: "PancakeSwap", mark: "/brand/logos/pancake.png" },
  { src: "/brand/partners/p5.svg?v=4", alt: "Goldman Sachs" },
  { src: "/brand/partners/p6.svg?v=4", alt: "Chainlink" },
  { src: "/brand/partners/p7.svg?v=4", alt: "Wellington" },
  { src: "/brand/partners/p8.svg?v=4", alt: "Trust Wallet" },
  { src: "/brand/partners/p9.svg?v=4", alt: "Franklin" },
  { src: "/brand/partners/p10.svg?v=4", alt: "USDT", mark: "/brand/logos/usdt.png" },
  { src: "/brand/partners/p11.svg?v=4", alt: "AON" },
  { src: "/brand/partners/p12.svg?v=4", alt: "Venus" },
];

const COMPARE = [
  { f: "Session-aware routing", venue: "yes", other: "partial", broker: "no" },
  { f: "Simulate before sign", venue: "yes", other: "no", broker: "no" },
  { f: "bStocks + Ondo + xStocks", venue: "yes", other: "partial", broker: "no" },
  { f: "DeFi park idle USDT", venue: "yes", other: "partial", broker: "no" },
  { f: "Size ladder & risk gates", venue: "yes", other: "no", broker: "partial" },
  { f: "Agentic NL desk", venue: "yes", other: "no", broker: "no" },
  { f: "BNB Chain mainnet", venue: "yes", other: "partial", broker: "no" },
  { f: "Wallet-native execution", venue: "yes", other: "yes", broker: "no" },
];

const FEATURES = [
  {
    t: "Instant route selection",
    d: "US open, pre-market, after-hours, and weekend each bias a different wrapper - RFQ vs AMM, automatically.",
  },
  {
    t: "Simulate-first swaps",
    d: "Every trade dry-runs through the Transaction API. Simulation gates block bad routes before you sign.",
  },
  {
    t: "Full wrapper coverage",
    d: "One ticker resolves across bStocks, Ondo, and xStocks with live spreads, liquidity, and session fit.",
  },
  {
    t: "Idle cash parking",
    d: "When equity venues go quiet, Venue builds a DeFi deposit path so USDT doesn't sit idle.",
  },
  {
    t: "Risk & size ladders",
    d: "Slippage, MEV hints, allowance checks, and size ladders surface before you commit capital.",
  },
  {
    t: "Agentic tape",
    d: "Natural-language intents resolve to quotes, portfolios, and park flows - sellable over x402.",
  },
];

function ScrollHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const p = useTransform(scrollYProgress, (v) => (reduce ? 1 : v));

  const inset = useTransform(p, [0, 0.72], [0, 18.75]);
  const radius = useTransform(p, [0.08, 0.72], [0, 88]);
  const clip = useMotionTemplate`inset(0px ${inset}% round ${radius}px)`;
  const scaleBack = useTransform(p, [0, 0.72], [1, 0.47]);
  const scaleMid = useTransform(p, [0, 0.72], [1, 0.45]);
  const scaleFront = useTransform(p, [0, 0.72], [1, 0.43]);
  const yBack = useTransform(p, [0, 0.72], [0, -78]);
  const yMid = useTransform(p, [0, 0.72], [0, -40]);
  const yFront = useTransform(p, [0, 0.72], [0, -4]);

  const frame = useTransform(p, [0, 0.72], [0, 30]);
  const frameW = useMotionTemplate`${frame}vw`;
  const gapPx = useTransform(p, [0, 0.72], [10, 72]);
  const sideGap = useMotionTemplate`${gapPx}px`;
  const wordColor = useTransform(p, [0.18, 0.48], ["rgb(255,255,255)", "rgb(17,17,17)"]);

  const captionY = useTransform(p, [0.5, 0.78], [16, 0]);
  const captionOpacity = useTransform(p, [0.55, 0.78], [0, 1]);
  const hintOpacity = useTransform(p, [0, 0.18], [1, 0]);

  return (
    <section ref={ref} className="relative h-[210vh] bg-white">
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-white">
        <h1 className="sr-only">Welcome to open market</h1>

        {(
          [
            [scaleBack, yBack, false],
            [scaleMid, yMid, false],
            [scaleFront, yFront, true],
          ] as const
        ).map(([scale, y, front], i) => (
          <motion.div
            key={i}
            style={{ scale, y, clipPath: clip }}
            className="absolute inset-0 origin-center will-change-transform"
          >
            {front ? (
              <video
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                poster="/brand/media/hero-sunrise.jpg"
              >
                <source src="/brand/media/hero-sunrise.mp4" type="video/mp4" />
              </video>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/brand/media/hero-sunrise.jpg"
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </motion.div>
        ))}

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center px-[5vw]">
          <motion.p
            style={{ color: wordColor }}
            className="display min-w-0 flex-1 whitespace-nowrap text-right text-[clamp(1.65rem,4.4vw,4.15rem)] leading-none tracking-[-0.045em]"
          >
            Welcome to
          </motion.p>
          <motion.div
            style={{ width: frameW, marginLeft: sideGap, marginRight: sideGap }}
            className="shrink-0"
          />
          <motion.p
            style={{ color: wordColor }}
            className="display min-w-0 flex-1 whitespace-nowrap text-left text-[clamp(1.65rem,4.4vw,4.15rem)] leading-none tracking-[-0.045em]"
          >
            open market
          </motion.p>
        </div>

        <motion.p
          style={{ y: captionY, opacity: captionOpacity }}
          className="absolute inset-x-0 top-[82%] z-10 mx-auto max-w-xl px-6 text-center text-[15px] leading-relaxed text-[var(--ink)] sm:text-[16px]"
        >
          Venue picks the live wrapper - bStocks, Ondo, or xStocks - by US
          session hours, simulates every route, then executes on mainnet.
        </motion.p>

        <motion.p
          style={{ opacity: hintOpacity }}
          className="absolute inset-x-0 bottom-8 z-10 text-center text-sm text-white/80"
        >
          Scroll to explore
        </motion.p>
      </div>
    </section>
  );
}

const DESKS = [
  {
    id: "route",
    name: "Session route",
    body: "US hours prefer Ondo RFQ. Pre-market, after-hours, and weekends prefer bStock SWAP. xStock stays off the ticket until it is listed on BSC.",
    pill: "Chain 56",
    accent: "#6d5efc",
    soft: "#f3f1ff",
    href: "/app",
    cta: "Open the desk",
    lead: { k: "Live issuers", v: "2", s: "bStock and Ondo on BSC" },
    mid: { k: "Quote life", v: "30s", s: "Then the route expires" },
    end: { k: "NVDAB vs reference", v: "7.8 bps", s: "Same NVDA snapshot" },
    series: [8, 12, 11, 16, 15, 18, 22, 21, 26, 24, 29, 33],
  },
  {
    id: "simulate",
    name: "Simulate",
    body: "Every swap is dry-run through the Transaction API. A route that would fail is blocked before you sign.",
    pill: "Before you sign",
    accent: "#3b6cff",
    soft: "#eef3ff",
    href: "/app?tab=trade",
    cta: "See a dry-run",
    lead: { k: "Gate", v: "1", s: "Simulate, then sign" },
    mid: { k: "Impact at $15", v: "0.00%", s: "NVDAB via LiquidMesh" },
    end: { k: "Stale quote", v: "40401", s: "QUOTE_EXPIRED past 30s" },
    series: [6, 9, 14, 13, 18, 22, 20, 24, 28, 27, 31, 36],
  },
  {
    id: "park",
    name: "Park",
    body: "When equity venues are closed, Venue builds a DeFi deposit for leftover USDT. Pools that reject BSC USDT are left off the list.",
    pill: "Idle USDT",
    accent: "#1f9d55",
    soft: "#eef8f2",
    href: "/app?tab=park",
    cta: "Park USDT",
    lead: { k: "Cash", v: "USDT", s: "18 decimals on BSC" },
    mid: { k: "Filtered out", v: "40484", s: "Earn rows that reject USDT" },
    end: { k: "Kept", v: "Lista", s: "USDT markets after the filter" },
    series: [10, 12, 11, 14, 18, 17, 21, 25, 24, 28, 32, 30],
  },
] as const;

function DotPlot({ values, color }: { values: readonly number[]; color: string }) {
  const w = 320;
  const h = 120;
  const max = Math.max(...values);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <line
          key={i}
          x1="0"
          x2={w}
          y1={20 + i * 28}
          y2={20 + i * 28}
          stroke="#ececec"
          strokeDasharray="3 6"
        />
      ))}
      {values.map((v, i) => (
        <circle
          key={i}
          cx={16 + (i * (w - 32)) / (values.length - 1)}
          cy={h - 12 - (v / max) * (h - 28)}
          r="4.5"
          fill={color}
        />
      ))}
    </svg>
  );
}

function Bars({ values, color }: { values: readonly number[]; color: string }) {
  const max = Math.max(...values);
  return (
    <div className="flex h-full items-end gap-1.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-md"
          style={{
            height: `${18 + (v / max) * 82}%`,
            background: color,
            opacity: 0.35 + (i / values.length) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

function ProductBoard() {
  const scroller = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: scroller,
    offset: ["start start", "end end"],
  });
  const [id, setId] = useState<(typeof DESKS)[number]["id"]>("route");
  const desk = DESKS.find((d) => d.id === id) ?? DESKS[0];

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduce) return;
    const next = DESKS[Math.min(DESKS.length - 1, Math.floor(v * DESKS.length))].id;
    setId((cur) => (cur === next ? cur : next));
  });

  return (
    <div ref={scroller} className={reduce ? "mt-12" : "relative mt-12 h-[260vh]"}>
    <div className={reduce ? undefined : "sticky top-20"}>
    <div className="rounded-[32px] border border-[#e7e7e7] bg-white p-2.5 sm:p-3">
      <div className="grid items-stretch gap-2.5 lg:min-h-[740px] lg:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.45fr)]">
        <div className="flex h-full flex-col gap-2.5">
          {DESKS.map((d) => {
            const on = d.id === desk.id;
            if (!on) {
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setId(d.id)}
                  className="flex h-[92px] shrink-0 items-center rounded-[24px] border border-[#ececec] bg-white px-7 text-left text-[32px] font-medium tracking-[-0.03em] transition hover:bg-[#fafafa]"
                >
                  {d.name}
                </button>
              );
            }
            return (
              <div
                key={d.id}
                className="flex min-h-[420px] flex-1 flex-col rounded-[24px] border border-[#ececec] bg-white p-7 sm:p-8"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 3.75v16.5M3.75 12h16.5" stroke="currentColor" strokeWidth="1.6" />
                    <ellipse cx="12" cy="12" rx="4" ry="8.25" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <h3 className="display mt-10 text-[40px] leading-none tracking-[-0.04em]">{d.name}</h3>
                <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-[var(--ink-soft)]">
                  {d.body}
                </p>
                <span className="mt-4 inline-flex w-fit rounded-full bg-[#f2f2f2] px-2.5 py-1 text-[12px] text-[var(--ink-soft)]">
                  {d.pill}
                </span>
                <div className="mt-auto flex items-end justify-between gap-4 pt-10">
                  <div className="flex -space-x-2">
                    {TAPE.slice(0, 4).map((t) => (
                      <span
                        key={t.s}
                        className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-white"
                      >
                        <Image src={t.logo} alt="" fill sizes="36px" />
                      </span>
                    ))}
                  </div>
                  <Link href={d.href} className="btn btn-primary h-11 px-5 text-[15px]">
                    {d.cta}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <motion.div
          key={desk.id}
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="grid h-full min-h-[520px] gap-2.5 lg:grid-rows-[1.15fr_0.95fr]"
        >
          <div className="flex min-h-[280px] flex-col rounded-[24px] border border-[#ececec] bg-white p-7 sm:p-8">
            <p className="text-[14px] text-[var(--ink-soft)]">{desk.lead.k}</p>
            <p className="display mt-2 text-[64px] leading-none tracking-[-0.045em]">{desk.lead.v}</p>
            <p className="mt-2 text-[14px] text-[var(--ink-soft)]">{desk.lead.s}</p>
            <div className="mt-4 min-h-[180px] flex-1">
              <DotPlot values={desk.series} color={desk.accent} />
            </div>
          </div>
          <div className="grid min-h-[240px] gap-2.5 sm:grid-cols-2">
            <div className="flex flex-col rounded-[24px] border border-[#ececec] bg-white p-7">
              <p className="text-[14px] text-[var(--ink-soft)]">{desk.mid.k}</p>
              <p className="display mt-2 text-[52px] leading-none tracking-[-0.045em]">{desk.mid.v}</p>
              <div className="mt-auto grid grid-cols-4 gap-2 pt-6">
                {TAPE.map((t) => (
                  <span
                    key={t.s}
                    className="relative aspect-square overflow-hidden rounded-xl bg-[#f4f4f4]"
                  >
                    <Image src={t.logo} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                ))}
              </div>
            </div>
            <div className="flex min-h-[220px] flex-col rounded-[24px] border border-[#ececec] bg-white p-7">
              <p className="text-[14px] text-[var(--ink-soft)]">{desk.end.k}</p>
              <p className="display mt-2 text-[52px] leading-none tracking-[-0.045em]">{desk.end.v}</p>
              <p className="mt-2 text-[14px] text-[var(--ink-soft)]">{desk.end.s}</p>
              <div className="mt-auto h-36 pt-4">
                <Bars values={desk.series} color={desk.accent} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
    </div>
    </div>
  );
}

function FeatureIcon({ name, large = false }: { name: string; large?: boolean }) {
  const paths: Record<string, string> = {
    "Session-aware routing": "M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
    "Simulate before sign": "M5 12h14M13 6l6 6-6 6",
    "bStocks + Ondo + xStocks": "M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z",
    "DeFi park idle USDT": "M12 3v18M8 7h6a3 3 0 0 1 0 6H8",
    "Size ladder & risk gates": "M4 19V5M4 19h16M8 15v4M12 9v10M16 12v7",
    "Agentic NL desk": "M5 6h14v9H8l-3 3V6z",
    "BNB Chain mainnet": "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z",
    "Wallet-native execution": "M4 8h16v10H4zM4 8l2-3h12l2 3M16 13h2",
    "Instant route selection": "M7 3h8l2 4H5l2-4zM5 7h14v12H5zM9 12h6",
    "Simulate-first swaps": "M7 7h10v10H7zM4 4l3 3M20 4l-3 3M4 20l3-3M20 20l-3-3",
    "Full wrapper coverage": "M4 7h16M4 12h16M4 17h10",
    "Idle cash parking": "M12 3v18M8 7h6a3 3 0 0 1 0 6H9",
    "Risk & size ladders": "M4 19V5M4 19h16M8 15v4M12 10v9M16 13v6",
    "Agentic tape": "M5 6h14v9H8l-3 3V6z",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className={large ? "h-7 w-7 shrink-0 text-white/80" : "h-[18px] w-[18px] shrink-0 text-white/70"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name] || "M12 12h.01"} />
    </svg>
  );
}

function Status({ kind }: { kind: string }) {
  if (kind === "yes") return <span className="compare-yes" aria-label="Yes" />;
  if (kind === "partial") return <span className="compare-partial" aria-label="Partial" />;
  return <span className="compare-no" aria-label="No" />;
}

export default function HomePage() {
  const reduceMotion = useReducedMotion();
  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader variant="dark" announce />

      <ScrollHero />

      <div className="border-y border-black/[0.06] bg-white py-6">
        <div className="partner-tape px-4">
          <div className="partner-tape-track">
            {[...PARTNERS, ...PARTNERS].map((p, i) => (
              <Image
                key={`${p.src}-${i}`}
                src={p.src}
                alt={p.alt}
                width={140}
                height={32}
                className="partner-logo opacity-80"
                unoptimized
              />
            ))}
          </div>
        </div>
      </div>

      {/* Product intro */}
      <section id="product" className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
          <FadeUp className="mx-auto max-w-3xl text-center">
            <p className="text-[15px] font-medium text-[var(--ink-soft)]">Our product</p>
            <h2 className="display mt-3 text-[clamp(2.4rem,5vw,3.75rem)] leading-[1.05] tracking-[-0.035em]">
              <span className="text-[var(--ink)]">A new standard</span>
              <br />
              <span className="text-[#b5b5b5]">for tokenized stocks.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-[1.5] text-[var(--ink-soft)]">
              One ticker. Three wrappers. Session autopilot chooses RFQ vs AMM,
              then parks idle USDT when equity venues go quiet.
            </p>
          </FadeUp>
          <ProductBoard />
        </div>

        <div className="mx-auto mt-16 grid max-w-[1320px] grid-cols-2 gap-4 px-4 sm:px-6 lg:grid-cols-4">
          {TAPE.map((t) => {
            const up = !t.d.startsWith("-");
            return (
              <div
                key={t.s}
                className="flex min-h-[340px] flex-col rounded-[24px] border border-black/[0.06] bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <Image
                      src={t.logo}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[18px] font-semibold leading-tight">
                      {t.s}
                    </div>
                    <div className="truncate text-[14px] text-[var(--ink-soft)]">
                      {t.n}
                    </div>
                  </div>
                </div>
                <div
                  className={`mt-3 flex flex-1 flex-col rounded-[18px] px-4 pb-2 pt-4 ${
                    up ? "bg-[#e8f6ef]" : "bg-[#fdecee]"
                  }`}
                >
                  <div className="text-[32px] font-semibold leading-none tracking-[-0.03em]">
                    {t.p}
                  </div>
                  <div
                    className={`mt-2 flex items-center gap-1.5 text-[14px] font-medium ${
                      up ? "text-[#0b7a45]" : "text-[#c62828]"
                    }`}
                  >
                    <svg
                      width="12"
                      height="10"
                      viewBox="0 0 12 10"
                      aria-hidden
                      className={up ? "" : "rotate-180"}
                    >
                      <path fill="currentColor" d="M6 0l6 10H0z" />
                    </svg>
                    {t.dp} ({t.d.replace("+", "").replace("-", "")}) 24H
                  </div>
                  <div className="mt-auto pt-2">
                    <Sparkline seed={t.s} up={up} height={120} className="w-full" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white pb-8 pt-4 sm:pb-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <h2 className="display max-w-md text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.15] tracking-[-0.03em] text-[var(--ink-soft)]">
            Venue keeps the wrapper that is{" "}
            <span className="text-[var(--ink)]">actually open.</span>
          </h2>
          <dl className="divide-y divide-black/10">
            {[
              ["2", "Live issuers", "bStock and Ondo on BSC"],
              ["10", "Names on the desk", "From NVDA to SPY"],
              ["30s", "Quote life", "Then the route expires"],
            ].map(([n, label, hint]) => (
              <div key={label} className="flex items-end justify-between gap-6 py-6">
                <div>
                  <dt className="display text-[clamp(3rem,6vw,4.5rem)] leading-none tracking-[-0.04em]">
                    {n}
                  </dt>
                </div>
                <dd className="pb-1 text-right text-[15px] leading-snug text-[var(--ink-soft)]">
                  <span className="block text-[var(--ink)]">{label}</span>
                  {hint}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Apps photo + partner tiles, Ondo size */}
      <section id="rails" className="section-dark py-16 sm:py-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <FadeUp className="mx-auto mb-10 max-w-3xl text-center">
            <p className="mx-auto w-fit rounded-full bg-[#143d28] px-3 py-1 text-[13px] font-medium text-[#7dffa1]">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#7dffa1]" />
              Live on the world&apos;s leading rails
            </p>
            <h2 className="display mt-5 text-[clamp(2.2rem,4.5vw,3.5rem)] leading-[1.05] tracking-[-0.03em]">
              450+ tokenized names
              <br />
              in your favorite apps.
            </h2>
          </FadeUp>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <div className="relative col-span-2 row-span-4 min-h-[520px] overflow-hidden rounded-[28px] bg-[#1a1a1a] lg:row-span-7 lg:min-h-[880px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/media/apps-commute.jpg"
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <div className="absolute inset-x-4 bottom-5 space-y-3 sm:inset-x-6 sm:bottom-8">
                <div className="glass-card float-y flex max-w-[280px] items-center gap-3 px-3.5 py-2.5">
                  <span className="relative h-9 w-9 overflow-hidden rounded-full bg-white/10">
                    <Image src="/brand/logos/nvdaon.png" alt="" fill sizes="36px" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">Nvidia</div>
                    <div className="text-xs text-white/55">3.05 NVDAon</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">$235.51</div>
                    <div className="text-xs text-[#7dffa1]">+0.35%</div>
                  </div>
                </div>
                <div className="glass-card float-y-delay ml-10 flex max-w-[280px] items-center gap-3 px-3.5 py-2.5">
                  <span className="relative h-9 w-9 overflow-hidden rounded-full bg-white/10">
                    <Image src="/brand/logos/amznon.png" alt="" fill sizes="36px" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">Amazon</div>
                    <div className="text-xs text-white/55">0.78 AMZNon</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">$223.62</div>
                    <div className="text-xs text-[#7dffa1]">+0.29%</div>
                  </div>
                </div>
              </div>
            </div>

            {RAILS.map((p) => (
              <div
                key={p.src}
                className="flex h-[96px] items-center justify-center rounded-[22px] bg-[#1c1c1c] px-6 sm:h-[108px] lg:h-auto lg:min-h-[112px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={p.alt}
                  className="h-8 w-auto max-w-[78%] object-contain sm:h-10"
                />
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/app" className="btn btn-on-dark">
              Explore Venue
            </Link>
            <Link href="/how-it-works" className="btn btn-glass">
              Read the flow
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="routes" className="section-dark border-t border-white/5 py-20 sm:py-28">
        <div className="mx-auto max-w-[1180px] px-5">
          <FadeUp className="text-center">
            <h2 className="display text-[clamp(2rem,3.6vw,3.35rem)] leading-[1.15] tracking-[-0.03em]">
              The best of traditional markets. The best of onchain execution.
            </h2>
          </FadeUp>

          <div className="mt-14 overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[minmax(240px,1.25fr)_repeat(3,minmax(150px,1fr))] items-end">
                <div className="flex h-16 items-end px-4 pb-3 pr-6 text-[15px] text-white/45">
                  Features
                </div>
                {(
                  [
                    { label: "Venue", boxed: true },
                    { label: "Single wrapper", boxed: false },
                    { label: "Brokers", boxed: false },
                  ]
                ).map((col) => (
                  <div
                    key={col.label}
                    className={
                      col.boxed
                        ? "mx-1 flex h-16 items-center justify-center rounded-t-[28px] border border-b-0 border-white/80 bg-transparent px-3 text-center text-[15px] font-medium leading-tight text-white"
                        : "mx-1 flex h-16 items-center justify-center rounded-2xl bg-[#1a1a1a] px-3 text-center text-[15px] font-medium leading-tight text-white"
                    }
                  >
                    {col.label}
                  </div>
                ))}
              </div>

              {COMPARE.map((row, i) => (
                <motion.div
                  key={row.f}
                  className="grid grid-cols-[minmax(240px,1.25fr)_repeat(3,minmax(150px,1fr))]"
                  initial={reduceMotion ? false : { opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "0px 0px -12% 0px" }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="my-1 mr-4 flex h-14 items-center gap-3 rounded-2xl bg-[#171717] px-4 text-[15px] text-white/90">
                    <FeatureIcon name={row.f} />
                    {row.f}
                  </div>
                  <div
                    className={`mx-1 flex h-14 items-center justify-center border-x border-white/80 ${
                      i === COMPARE.length - 1 ? "rounded-b-[28px] border-b" : ""
                    }`}
                  >
                    <Status kind={row.venue} />
                  </div>
                  <div className="mx-1 flex h-14 items-center justify-center">
                    <Status kind={row.other} />
                  </div>
                  <div className="mx-1 flex h-14 items-center justify-center">
                    <Status kind={row.broker} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Future of portfolios + app demo */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <FadeUp>
            <h2 className="display text-4xl sm:text-5xl md:text-[3.25rem]">
              The future of portfolios is onchain.
            </h2>
          </FadeUp>

          <ScaleIn delay={0.15} className="relative mx-auto mt-14 max-w-6xl">
            <div className="media-frame aspect-[3200/1658] bg-white">
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className="h-full w-full object-contain"
              >
                <source src="/global-markets-app-demo_kwv9ul.mp4" type="video/mp4" />
              </video>
            </div>
          </ScaleIn>
        </div>
      </section>

      {/* Feature bento */}
      <section className="section-dark py-20 sm:py-28">
        <div className="mx-auto max-w-[1080px] px-5">
          <FadeUp className="text-center">
            <h2 className="display text-[clamp(2.5rem,4.6vw,3.75rem)] leading-[1.08] tracking-[-0.03em]">
              Reimagining investing
              <br />
              for global markets
            </h2>
          </FadeUp>
          <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 sm:gap-5">
            {FEATURES.map((f) => (
              <StaggerItem key={f.t}>
                <div className="h-full min-h-[220px] rounded-[28px] bg-[#1c1c1c] px-8 py-8 sm:px-9 sm:py-9">
                  <FeatureIcon name={f.t} large />
                  <h3 className="mt-8 text-[17px] font-semibold tracking-[-0.01em] text-white">
                    {f.t}
                  </h3>
                  <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-white/55">
                    {f.d}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Build / API */}
      <section id="build" className="section-dark border-t border-white/5 py-24 sm:py-32">
        <div className="api-split mx-auto max-w-7xl px-5">
          <FadeUp>
            <h2
              className="display leading-none tracking-tight"
              style={{ fontSize: "clamp(3rem, 5vw, 4.75rem)" }}
            >
              One desk.
              <br />
              Three wrappers.
            </h2>
            <p className="mt-6 max-w-[420px] text-[17px] leading-relaxed text-white/60">
              Build investing experiences on top of Venue&apos;s resolve, ladder,
              simulate, and park APIs - or sell tape data over the Agent Studio face.
            </p>
            <Link href="/how-it-works" className="btn btn-glass mt-8">
              Read documentation
            </Link>
          </FadeUp>

          <div className="grid gap-5">
            <ScaleIn>
              <div className="relative aspect-video overflow-hidden rounded-[28px] bg-[#161616]">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="/brand/media/api-web-poster.jpg"
                  className="absolute inset-0 h-full w-full object-cover"
                >
                  <source src="/brand/media/api-web.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                  <p className="text-sm text-white/80">Web & mobile</p>
                  <p className="mt-3 max-w-[440px] text-[clamp(1.15rem,2vw,1.65rem)] font-medium leading-snug text-white">
                    REST resolve, ladder, portfolio, and agent routes - no chain
                    plumbing required to start.
                  </p>
                </div>
              </div>
            </ScaleIn>
            <ScaleIn delay={0.1}>
              <div className="relative aspect-video overflow-hidden rounded-[28px] bg-[#161616]">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="/brand/media/api-chain-poster.jpg"
                  className="absolute inset-0 h-full w-full object-cover"
                >
                  <source src="/brand/media/api-chain.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                  <p className="text-sm text-white/80">Blockchain</p>
                  <p className="mt-3 max-w-[440px] text-[clamp(1.15rem,2vw,1.65rem)] font-medium leading-snug text-white">
                    Wallet-native SWAP / RFQ execution on BNB Smart Chain with
                    allowance and gas awareness.
                  </p>
                </div>
              </div>
            </ScaleIn>
          </div>
        </div>
      </section>

      {/* Closing panel */}
      <section className="bg-white px-4 pb-2 pt-6 sm:px-6 sm:pb-3">
        <div className="relative mx-auto min-h-[540px] overflow-hidden rounded-[28px] sm:min-h-[620px] sm:rounded-[32px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/media/contact-bg.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative flex min-h-[540px] flex-col items-center justify-center px-6 py-16 text-center sm:min-h-[620px]">
            <h2 className="display text-[clamp(2.6rem,5vw,4.25rem)] leading-[1.05] tracking-[-0.03em] text-white">
              Get on the desk
            </h2>
            <p className="mt-4 max-w-xl text-[clamp(1.15rem,2vw,1.65rem)] leading-snug text-white/90">
              Connect a wallet, resolve a ticker, and run a simulated route on
              mainnet.
            </p>
            <Link href="/app" className="btn btn-on-dark mt-8 h-12 px-6 text-[15px]">
              Open app
            </Link>
          </div>
        </div>
      </section>

      {/* Footer - Ondo-style wordmark + utility bar */}
      <SiteFooter />
    </main>
  );
}
