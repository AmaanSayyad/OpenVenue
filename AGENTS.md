# OpenVenue — agent notes (Monad)

This repo is **OpenVenue**, a tokenized-stock desk for **Monad Blitz**.

## Chain defaults

- Prefer **Monad Mainnet `143`** and **Monad Testnet `10143`**
- Platform fees + Park + OpenVenueDesk always settle / live on Monad
- Stock fills may MetaMask-switch to an issuer venue; do not remove Monad fee hop
- Single env file: `.env` (never introduce `.env.local` for this app)

## Docs

- Product / run: `README.md`
- Hackathon: `docs/HACKATHON.md`
- DX / submission notes: `docs/DX-REPORT.md`
- Contracts: `contracts/` + `contracts/deployments.json`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` - verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
