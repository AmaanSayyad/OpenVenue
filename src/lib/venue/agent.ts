/**
 * Lightweight NL intent parser for OpenVenue agent mode.
 * Examples: "buy $20 NVDA best venue", "sell half NVDAB", "park usdt"
 */

export type AgentIntent =
  | {
      action: "buy";
      ticker: string;
      amountUsdt: number;
      raw: string;
    }
  | {
      action: "sell";
      tickerOrSymbol: string;
      fraction: number; // 0–1
      raw: string;
    }
  | {
      action: "park";
      raw: string;
    }
  | {
      action: "ladder";
      ticker: string;
      raw: string;
    }
  | {
      action: "portfolio";
      raw: string;
    }
  | {
      action: "unknown";
      raw: string;
      hint: string;
    };

const TICKERS =
  /\b(NVDA|AAPL|TSLA|META|SPY|AMZN|GOOGL|MSFT|NFLX|COIN|NVDAB|NVDAon|AAPLB|TSLAB|METAB|SPYB)\b/i;

export function parseAgentIntent(input: string): AgentIntent {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  if (/\b(portfolio|balances|positions|holdings)\b/.test(lower)) {
    return { action: "portfolio", raw };
  }
  if (/\b(park|earn|defi|idle)\b/.test(lower)) {
    return { action: "park", raw };
  }
  if (/\b(ladder|sizes|depth|impact)\b/.test(lower)) {
    const m = raw.match(TICKERS);
    return {
      action: "ladder",
      ticker: (m?.[1] || "NVDA").toUpperCase().replace(/(ON|B|X)$/i, ""),
      raw,
    };
  }
  if (/\b(sell|exit|unload)\b/.test(lower)) {
    const m = raw.match(TICKERS);
    let fraction = 1;
    if (/\bhalf\b|\b50%\b/.test(lower)) fraction = 0.5;
    else if (/\bquarter\b|\b25%\b/.test(lower)) fraction = 0.25;
    const pct = lower.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pct) fraction = Math.min(1, Number(pct[1]) / 100);
    return {
      action: "sell",
      tickerOrSymbol: (m?.[1] || "NVDAB").toUpperCase(),
      fraction,
      raw,
    };
  }
  if (/\b(buy|long|get|purchase|route)\b/.test(lower) || TICKERS.test(raw)) {
    const m = raw.match(TICKERS);
    const amt =
      raw.match(/\$\s*(\d+(?:\.\d+)?)/)?.[1] ||
      raw.match(/(\d+(?:\.\d+)?)\s*(?:usdt|usd)\b/i)?.[1] ||
      "15";
    const sym = (m?.[1] || "NVDA").toUpperCase();
    const ticker = sym.replace(/(ON|B|X)$/i, "");
    return {
      action: "buy",
      ticker,
      amountUsdt: Number(amt),
      raw,
    };
  }
  return {
    action: "unknown",
    raw,
    hint: 'Try: "buy $20 NVDA best venue", "sell half NVDAB", "park usdt", "ladder TSLA", "portfolio"',
  };
}
