/** Turn wallet / viem errors into short desk copy. */
export function formatWalletError(
  err: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : fallback;
  const lower = raw.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("denied transaction signature") ||
    lower.includes("request rejected") ||
    // viem / MetaMask numeric codes
    lower.includes("4001") ||
    lower.includes("action_rejected")
  ) {
    return "You cancelled the wallet request. Nothing was sent.";
  }

  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) {
    return "Not enough balance in this wallet for that amount.";
  }

  if (lower.includes("chain") && (lower.includes("mismatch") || lower.includes("wrong network"))) {
    return "Wrong network in the wallet. Switch to Monad and try again.";
  }

  if (lower.includes("getchainid is not a function")) {
    return "Wallet session glitched. Disconnect MetaMask in the app, reconnect on Monad, then try again.";
  }

  if (lower.includes("quote expired")) {
    return "The quote expired. Refresh the route and confirm again.";
  }

  if (lower.includes("simulation gate")) {
    return "The simulation gate stopped the trade before it was sent.";
  }

  // Strip viem "Request Arguments:" dumps — keep first sentence only
  const cut = raw.split(/Request Arguments:|Details:|Version:/i)[0]?.trim();
  if (cut && cut.length > 0 && cut.length < 160) return cut;
  if (cut && cut.length >= 160) return `${cut.slice(0, 140).trim()}…`;

  return fallback;
}
