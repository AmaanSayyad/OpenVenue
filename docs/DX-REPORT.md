# Developer Experience Report - OpenVenue

> Hackathon: BNB Hack Tokenized Stocks Edition  
> Project: OpenVenue (session-aware multi-wrapper router)  
> Pitch deck: https://app.chroniclehq.com/share/0f55cc23-897b-4a17-9ae9-c430e7e7eadb/610bb562-477b-4a08-97fa-acb555e80fc0  
> Pitch + demo video: https://youtu.be/75Z0NS4IlZI  
> Notes captured while integrating Binance Web3 `/build` APIs on BSC mainnet (2026-10-05).

## Onboarding

- Docs opened (UTC): 2026-10-05 ~09:40
- First successful signed API call (UTC): 2026-10-05 ~10:14 (`GET /api/v1/dex/market/rwa/search`)
- Time to first success: ~35 min from scaffolding to first HMAC-signed 200
- Where we got stuck:
  1. RWA search response shape is `{ ticker, companyName, assets[] }` - not a flat token list. Parsing `symbol`/`contractAddress` at the top level returned zero candidates until we flattened `assets`.
  2. Aggregator quote parameter is `amount` (wei string), not `fromTokenAmount`. Sending only `fromTokenAmount` returns `40001: Parameter [amount] is required`.
  3. Ondo quotes require `userWalletAddress` even for a dry quote (`40001: userWalletAddress is required for RFQ (Ondo) quote`). Anonymous browse works for bStock SWAP only.
  4. `nextUsOpen` that stepped +30 minutes from “now” skipped exact 09:30 ET; replaced with calendar-day ET construction.

## Documentation issues

| Page URL | Exact location | What was wrong |
| --- | --- | --- |
| Dev Portal OpenAPI / RWA search | Response schema for `/api/v1/dex/market/rwa/search` | Nested `assets[]` with `platformId` + `tokenContractAddress` not obvious from naming alone |
| Aggregator quote docs | Query params | Easy to confuse `amount` vs `fromTokenAmount`; error message helps but costs a round-trip |
| Agentic Wallet market-order skill | CLI vs raw `/build` | Skill documents `baw market-order quote` (human qty); raw Trading API expects wei `amount` + contract addresses |

## API pitfalls

| Endpoint | Error code / msg | Cause | Workaround |
| --- | --- | --- | --- |
| Signature `/build` prefix | 401 / invalid sign | Prehash must use path including `/build` + query string | `timestamp + METHOD + /build/api/...?... + body` |
| `/api/v1/dex/aggregator/quote` | 40001 amount required | Used `fromTokenAmount` only | Pass `amount` (18-dec wei for BSC USDT) |
| Same | 40001 userWalletAddress required for RFQ (Ondo) | Wallet omitted on resolve | Pass connected wallet; UI still shows bStock SWAP |
| `/api/v1/dex/aggregator/approve-transaction` | - | Payload is `[{ data, dexContractAddress, gasLimit }]` with **no `to`** | `to` is the ERC-20 token itself; OpenVenue normalizes this |
| RFQ outside hours | 40367 / 40369 (expected) | Hours-bound RFQ | Prefer SWAP / Off-Hours wrappers; session scorer already biases AMM off-hours |
| `/api/v1/dex/market/rwa/tokens` | - | Returns all BSC RWAs (ondo+bstock); no xStock rows observed 2026-10-05 | Keep xStock branch; UI notes when absent |

## AI stack feedback

- Wallet Skills / Agentic Wallet used? **Y** - skills installed under `.agents/skills/`; guided endpoint discovery and security pre-check framing. Raw `/build` still required for the web app.
- `bag` / Agent Studio used? **Partial** - seller core stub at `agents/venue-tape/sellerCore.ts` calls OpenVenue `/api/venue/resolve`. Full `bag init` + B402 merchant activation pending API key scopes + deploy wallet.
- What worked / missing: Skills are excellent for CLI agent flows; OpenAPI examples for nested RWA search would cut onboarding time.

## Tokenized-stock specifics

| Observation | Detail |
| --- | --- |
| Liquidity depth (NVDA wrappers) | NVDAB (bStock) + NVDAon (Ondo) on BSC; ~15 USDT → ~0.0637 NVDAB via LiquidMesh SWAP (pre-market) |
| Slippage at $15 / $50 | $15 quote showed ~0.00% priceImpactPercent on LiquidMesh; re-check at $50–$200 before demo |
| Outside US hours behaviour | Pre-market: scorer prefers AMM/SWAP; Ondo RFQ needs wallet; session labels drive UI copy |
| On-chain vs reference gap | NVDAB ~7.8 bps premium; NVDAon ~17 bps (same snapshot) |
| bStocks vs Ondo vs xStocks | Live: bstock + ondo only on `/rwa/tokens` for chain 56 today; xStocks path ready when listed |
| Round-trip E2E (2026-10-05) | BNB→USDT→NVDAB then NVDAB→USDT on mainnet; sim gate passed; ~3.81 USDT recovered |
| DeFi park filter | Some “Earn” rows reject BSC USDT (`40484`); prefer Lista/Aave after client-side USDT filter |

## Redesign suggestions

If rebuilding the developer platform so someone can call APIs the moment they land:

1. Ship a “copy curl” playground that already includes HMAC headers for the logged-in project.
2. Document RWA search response with a real NVDA payload (nested assets + multi-chain).
3. One “first trade” recipe: search → quote (`amount`) → approve → swap → simulate, with BSC USDT decimals called out.

## Requested capabilities

- Streaming quote updates / websocket for RFQ fill status
- Explicit “SWAP-only” query flag so Ondo does not hard-fail without a wallet
- Public xStock presence filter on BSC token list

## Submission checklist

- [ ] Public repo
- [ ] Deployed link / run instructions
- [x] Pitch + demo video: https://youtu.be/75Z0NS4IlZI
- [ ] This report submitted via https://forms.gle/EUQ39xf54GHjC2ys5
- [ ] Project form https://forms.gle/yToDUzaDMwWnq6R6A
