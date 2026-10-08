import type { TradeReceipt } from "@/lib/venue/receipts";

const SHARE_KEY = "venue.share.receipts.v1";

type ShareMap = Record<string, TradeReceipt>;

function read(): ShareMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SHARE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function publishShareReceipt(receipt: TradeReceipt): string {
  const map = read();
  map[receipt.id] = receipt;
  localStorage.setItem(SHARE_KEY, JSON.stringify(map));
  return receipt.id;
}

export function loadShareReceipt(id: string): TradeReceipt | null {
  return read()[id] || null;
}

export function shareReceiptUrl(id: string) {
  if (typeof window === "undefined") return `/receipt/${id}`;
  return `${window.location.origin}/receipt/${id}`;
}

export async function copyShareReceipt(receipt: TradeReceipt) {
  const id = publishShareReceipt(receipt);
  const url = shareReceiptUrl(id);
  const text = [
    `OpenVenue trade receipt`,
    `${receipt.side.toUpperCase()} ${receipt.symbol || receipt.ticker}`,
    `Amount: ${receipt.amountLabel}`,
    receipt.outAmountHuman ? `Out: ${receipt.outAmountHuman}` : null,
    receipt.wrapperKind ? `Wrapper: ${receipt.wrapperKind}` : null,
    receipt.mode ? `Mode: ${receipt.mode}` : null,
    receipt.vendor ? `Vendor: ${receipt.vendor}` : null,
    receipt.sessionState ? `Session: ${receipt.sessionState}` : null,
    `Status: ${receipt.status}`,
    receipt.txHash ? `Tx: ${receipt.txHash}` : null,
    url,
  ]
    .filter(Boolean)
    .join("\n");

  if (navigator.share) {
    try {
      await navigator.share({ title: "OpenVenue receipt", text, url });
      return { ok: true as const, url, shared: true };
    } catch {
      /* fall through to clipboard */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true as const, url, shared: false };
  } catch {
    return { ok: false as const, url, shared: false };
  }
}
