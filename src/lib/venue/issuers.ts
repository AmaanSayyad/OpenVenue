/**
 * Live tokenized-equity issuer registry.
 * Execution can land on BSC (bStocks / Ondo / xStocks) or Monad (Anchored).
 * Platform fees always settle on Monad.
 */

export const BSC_CHAIN_ID = 56;
export const MONAD_EXEC_CHAIN_ID = 143;

export type IssuerId = "anchored" | "xstocks" | "ondo" | "bstocks";

export type VenueListing = {
  issuer: IssuerId;
  platform: string;
  symbol: string;
  underlying: string;
  name: string;
  contractAddress: `0x${string}`;
  /** Chain where the buy/sell tx is broadcast (MetaMask switches here) */
  executionChainId: number;
  /** Quote / pay token on the execution chain */
  quoteToken: `0x${string}`;
  quoteDecimals: number;
  spreadBps: number;
  liquidity: number;
  hours: "24/7" | "us_equity";
  live: boolean;
  notes?: string;
};

/** Circle / Binance-peg USDT on BSC (18 decimals) */
export const USDT_BSC =
  "0x55d398326f99059fF775485246999027B3197955" as const;
export const WBNB_BSC =
  "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const;

/** Anchored aStocks - same address on Monad / ETH / Base / Arb */
const ANCHORED: Record<string, `0x${string}`> = {
  NVDA: "0x701193374879131f923532987c7Ef363a91a80eB",
  AAPL: "0x17683e492d0C8910F7c0157D04af31Cb7A23Ad71",
  TSLA: "0x10FAD4A60Adb421F8F5Ca6f9f2eAf2DbC110E146",
  META: "0xa1847139cbd660ABC2f7b889d7CBCF18C56407fb",
  SPY: "0x4716Cfb68C73BfF797Eea4f94ffAD8d198aEfC4B",
  AMZN: "0x06f272082339A90e81e1DCB8AB892fD1a8c5E4C0",
  GOOGL: "0xBDe676CDF5564Ef64CCD8555Aa9B56867D8D1aD5",
  MSFT: "0x73E9EB2C7a4B4E8c68232b31Ea0F1246963D0375",
  AMD: "0xbdf82C0DAFCf73834d10639c0F0Bf14b84808C43",
};

/** Binance bStocks on BSC */
const BSTOCKS: Record<string, `0x${string}`> = {
  NVDA: "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436",
  AAPL: "0x431a3BEE82E2ca41e49895CbECE5bB0F76A89b7A",
  TSLA: "0x5b1910eAaD6450E50f816082Aa078C41F10C292f",
  META: "0x7425889FE94F9d693E8daefE88BCCed6AcFEf4c0",
  SPY: "0x7138b48df7D98D7e3cc221BfE7192D0a178182D8",
  AMZN: "0x1a4b499833A79A09ad7Cf1D42D7DacF71e92eb00",
  GOOGL: "0x3F53De71c126BdaBAe20f9cD64848d317f6C3238",
  MSFT: "0x80106cb3EAD06659A5ad19DF39D9b4733863B9b0",
  AMD: "0x75Fd4cF6f8392E41E70391D60c90C0D5211603a1",
  NFLX: "0xD6829Ea836b6FA224d099D40E54B31262f874631",
};

/** Ondo Global Markets on BSC (where listed) */
const ONDO: Record<string, `0x${string}`> = {
  NVDA: "0xA9eE28C80f960B889dFbd1902055218cBa016F75",
  AAPL: "0x390a684EF9cADE28A7AD0DFa61AB1Eb3842618c4",
  TSLA: "0x2494b603319d4D9F9715c9f4496d9E0364B59d93",
  SPY: "0x6a708EAD771238919D85930b5a0f10454E1C331a",
  AMZN: "0x4553cFe1C09f37f38b12dC509F676964e392F8Fc",
  GOOGL: "0x091FC7778e6932d4009B087B191D1EE3bac5729A",
};

/** xStocks (Backed) on BSC - same address pattern across EVM where listed */
const XSTOCKS: Record<string, `0x${string}`> = {
  NVDA: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d",
};

export const CORE_UNDERLYINGS = [
  "NVDA",
  "AAPL",
  "TSLA",
  "META",
  "SPY",
  "AMZN",
  "GOOGL",
  "MSFT",
  "AMD",
  "NFLX",
] as const;

const REF_PRICES: Record<string, number> = {
  NVDA: 235.51,
  AAPL: 258.12,
  TSLA: 248.4,
  META: 612.05,
  SPY: 582.1,
  AMZN: 223.62,
  GOOGL: 178.45,
  MSFT: 428.9,
  AMD: 142.3,
  NFLX: 912.4,
};

export function referencePrice(ticker: string): number {
  return REF_PRICES[ticker.toUpperCase()] ?? 100;
}

function listingsFor(ticker: string): VenueListing[] {
  const t = ticker.toUpperCase();
  const out: VenueListing[] = [];

  const b = BSTOCKS[t];
  if (b) {
    out.push({
      issuer: "bstocks",
      platform: "bStocks",
      symbol: `${t}B`,
      underlying: t,
      name: `${t} · bStocks`,
      contractAddress: b,
      executionChainId: BSC_CHAIN_ID,
      quoteToken: USDT_BSC,
      quoteDecimals: 18,
      spreadBps: 8,
      liquidity: t === "AMD" ? 40 : 92,
      hours: "24/7",
      live: true,
      notes: "Live on BNB Chain - MetaMask switches to BSC; OpenVenue fee settles on Monad.",
    });
  }

  const x = XSTOCKS[t];
  if (x) {
    out.push({
      issuer: "xstocks",
      platform: "xStocks",
      symbol: `${t}x`,
      underlying: t,
      name: `${t} · xStocks`,
      contractAddress: x,
      executionChainId: BSC_CHAIN_ID,
      quoteToken: USDT_BSC,
      quoteDecimals: 18,
      spreadBps: 12,
      liquidity: 70,
      hours: "24/7",
      live: true,
      notes:
        "xStock on BNB Chain — only recommended when PancakeSwap has a live path.",
    });
  } else {
    out.push({
      issuer: "xstocks",
      platform: "xStocks",
      symbol: `${t}x`,
      underlying: t,
      name: `${t} · xStocks`,
      contractAddress: "0x0000000000000000000000000000000000000000",
      executionChainId: BSC_CHAIN_ID,
      quoteToken: USDT_BSC,
      quoteDecimals: 18,
      spreadBps: 12,
      liquidity: 50,
      hours: "24/7",
      live: false,
      notes: "xStock contract not wired for this ticker yet.",
    });
  }

  const o = ONDO[t];
  if (o) {
    out.push({
      issuer: "ondo",
      platform: "Ondo",
      symbol: `${t}on`,
      underlying: t,
      name: `${t} · Ondo`,
      contractAddress: o,
      executionChainId: BSC_CHAIN_ID,
      quoteToken: USDT_BSC,
      quoteDecimals: 18,
      spreadBps: 15,
      liquidity: 55,
      hours: "us_equity",
      live: true,
      notes: "Live Ondo token on BNB Chain.",
    });
  } else {
    out.push({
      issuer: "ondo",
      platform: "Ondo",
      symbol: `${t}on`,
      underlying: t,
      name: `${t} · Ondo`,
      contractAddress: "0x0000000000000000000000000000000000000000",
      executionChainId: BSC_CHAIN_ID,
      quoteToken: USDT_BSC,
      quoteDecimals: 18,
      spreadBps: 15,
      liquidity: 40,
      hours: "us_equity",
      live: false,
      notes: "Ondo listing not available on BSC for this ticker yet.",
    });
  }

  const a = ANCHORED[t];
  if (a) {
    out.push({
      issuer: "anchored",
      platform: "Anchored",
      symbol: `a${t}`,
      underlying: t,
      name: `${t} · Anchored`,
      contractAddress: a,
      executionChainId: MONAD_EXEC_CHAIN_ID,
      quoteToken: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
      quoteDecimals: 6,
      spreadBps: 20,
      liquidity: 25,
      hours: "24/7",
      live: true,
      notes:
        "Listed on Monad (Anchored aStock). Compare-only in OpenVenue until an AMM / RFQ path is wired — fills use BSC venues today.",
    });
  }

  return out;
}

export function searchVenues(ticker: string): VenueListing[] {
  const t = ticker.trim().toUpperCase();
  if (!t) return [];
  if (CORE_UNDERLYINGS.includes(t as (typeof CORE_UNDERLYINGS)[number])) {
    return listingsFor(t);
  }
  for (const u of CORE_UNDERLYINGS) {
    if (t.startsWith(u) || t === `A${u}` || t.endsWith("B") || t.endsWith("X") || t.endsWith("ON")) {
      if (t.includes(u)) return listingsFor(u);
    }
  }
  for (const u of CORE_UNDERLYINGS) {
    if (t.startsWith(u)) return listingsFor(u);
  }
  return listingsFor(t);
}

export function listExploreMarkets() {
  return CORE_UNDERLYINGS.map((u) => ({
    ticker: u,
    referencePrice: referencePrice(u),
    venues: listingsFor(u).filter((v) => v.live).length,
    totalVenues: listingsFor(u).length,
  }));
}

/** OpenVenue take rate in bps — settled on Monad to NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT */
export const PLATFORM_FEE_BPS = Number(
  process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS || "15",
);

export function platformFeeRecipient(): `0x${string}` {
  return (process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT ||
    "0xe9BEa05Fc2927d1A2Ef6BD59B1d492d42965896e") as `0x${string}`;
}
