import type { SessionState } from "./types";

/** US equity regular session: 9:30–16:00 America/New_York */
export function getUsEquitySession(now = new Date()): {
  state: SessionState;
  label: string;
  nextOpen: Date;
} {
  const { weekday, mins } = etClock(now);
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const nextOpen = nextUsOpen(now);

  if (isWeekend) {
    return {
      state: "weekend",
      label: "US market closed for the weekend - on-chain still trades",
      nextOpen,
    };
  }

  // Pre-market 4:00–9:30 ET
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) {
    return {
      state: "pre_market",
      label: "US pre-market - RFQ may be limited; AMM / Off-Hours still live",
      nextOpen,
    };
  }

  // Regular 9:30–16:00 ET
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) {
    return {
      state: "open",
      label: "US regular session open - RFQ venues usually deepest",
      nextOpen,
    };
  }

  // After hours 16:00–20:00 ET
  if (mins >= 16 * 60 && mins < 20 * 60) {
    return {
      state: "after_hours",
      label: "US after-hours - prefer AMM / Off-Hours-enabled wrappers",
      nextOpen,
    };
  }

  return {
    state: "closed",
    label: "US overnight closed - route to 24/7 liquidity (xStocks / bStock AMM)",
    nextOpen,
  };
}

function etClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));

  return {
    weekday: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute,
    mins: hour * 60 + minute,
  };
}

/** Next Mon–Fri 09:30 America/New_York as a real Date. */
function nextUsOpen(now: Date): Date {
  const et = etClock(now);
  const openMins = 9 * 60 + 30;

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const probe = new Date(
      Date.UTC(et.year, et.month - 1, et.day + dayOffset, 12, 0, 0),
    );
    const clock = etClock(probe);
    if (clock.weekday === "Sat" || clock.weekday === "Sun") continue;
    if (dayOffset === 0 && et.mins >= openMins) continue;

    // Build 09:30 ET on that calendar day via iterative search in UTC
    const target = findEtInstant(clock.year, clock.month, clock.day, 9, 30);
    if (target.getTime() > now.getTime()) return target;
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

function findEtInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  // Start near noon UTC and binary-adjust toward the ET wall time
  let guess = Date.UTC(year, month - 1, day, 14, minute, 0);
  for (let i = 0; i < 8; i++) {
    const c = etClock(new Date(guess));
    const deltaMins =
      (hour - c.hour) * 60 +
      (minute - c.minute) +
      (day - c.day) * 24 * 60 +
      (month - c.month) * 24 * 60 * 32;
    if (Math.abs(deltaMins) < 1 && c.day === day && c.month === month) {
      return new Date(guess);
    }
    guess += deltaMins * 60 * 1000;
  }
  return new Date(guess);
}

export function sessionPrefersAmm(state: SessionState) {
  return state === "weekend" || state === "closed" || state === "after_hours";
}
