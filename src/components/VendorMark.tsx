"use client";

import Image from "next/image";
import clsx from "clsx";

const LOGOS: Array<[string, string]> = [
  ["liquidmesh", "/brand/logos/liquidmesh.png"],
  ["pancake", "/brand/logos/pancake.png"],
  ["uniswap", "/brand/logos/uniswap.png"],
  ["ondo", "/brand/logos/ondo.svg"],
  ["binance", "/brand/logos/bnb.png"],
];

export function vendorLogo(name?: string | null) {
  if (!name) return null;
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = LOGOS.find(([needle]) => key.includes(needle));
  return hit?.[1] ?? null;
}

export function VendorName({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  if (!name) return null;
  const logo = vendorLogo(name);
  return (
    <span className={clsx("inline-flex items-center gap-1.5", className)}>
      {logo && (
        <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full bg-white">
          <Image src={logo} alt="" fill className="object-cover" sizes="16px" />
        </span>
      )}
      {name}
    </span>
  );
}
