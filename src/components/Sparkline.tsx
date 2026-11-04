"use client";

import { useMemo } from "react";

/** Deterministic decorative sparkline - visual polish, not live OHLC. */
export function Sparkline({
  seed,
  up = true,
  className = "",
  height = 56,
}: {
  seed: string;
  up?: boolean;
  className?: string;
  height?: number;
}) {
  const { line, area } = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const pts: Array<[number, number]> = [];
    const n = 28;
    let y = 55;
    for (let i = 0; i < n; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      const drift = up ? -0.55 : 0.55;
      const noise = ((h % 1000) / 1000 - 0.5) * 14;
      y = Math.max(8, Math.min(92, y + drift + noise));
      pts.push([(i / (n - 1)) * 100, y]);
    }
    const line = pts.map(([x, yy], i) => `${i === 0 ? "M" : "L"}${x},${yy}`).join(" ");
    const area = `${line} L100,100 L0,100 Z`;
    return { line, area };
  }, [seed, up]);

  const stroke = up ? "#007a4b" : "#c62828";
  const gid = `spark-${seed.replace(/[^a-z0-9]/gi, "").slice(0, 12)}-${up ? "u" : "d"}`;
  const fill = `url(#${gid})`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      style={{ height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={fill} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
