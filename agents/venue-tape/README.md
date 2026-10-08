# Venue Tape (Agent Studio seller)

Paid session-aware venue recommendations for tokenized stocks on BSC.

## Layout

- Scaffold: [`../../venuetape`](../../venuetape) (`bag init venuetape`)
- Work hook: `venuetape/app/agent/src/venueWork.ts` → calls Venue `GET /api/venue/resolve`
- Price: `$0.05` per job (ERC-8183 + x402/B402) on `bsc-mainnet`

## Local run

```bash
# Terminal A - Venue app
cd ../.. && npm run dev

# Terminal B - seller
cd ../../venuetape
pnpm install
(cd app/agent && bag wallet new --generate-password)
export VENUE_APP_URL=http://127.0.0.1:3000
bag doctor
bag dev
```

B402 merchant credentials (paid `/x402`) require a separate Binance Onchain Pay application bound to the agent wallet. Until then, ERC-8183 local negotiate still works after wallet creation.

## Stub

`sellerCore.ts` in this folder is a portable reference of the resolve → deliverable shape for non-Studio hosts.
