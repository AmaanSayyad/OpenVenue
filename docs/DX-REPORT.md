# Developer Experience Report — OpenVenue on Monad

> Site: https://openvenue.xyz  
> Repo: https://github.com/AmaanSayyad/OpenVenue  
> Hackathon: **Monad Blitz Mumbai · Devcon Edition** (4 Nov 2026)  
> Project: OpenVenue — session-aware tokenized-stock aggregator with **Monad as home base**  
> Pitch deck: https://app.chroniclehq.com/amaan-s-workspace/openvenue-monad  
> Demo video: https://drive.google.com/drive/folders/1TuNcIJzfz2zBeFZEqPaOEqWkbUR-vCXw?usp=sharing  
> Tweet: https://x.com/amaanbiz/status/2117954547817828767  
> Team: Amaan Sayyad · Shivam Sharma

## Product (Monad)

| Surface | Detail |
| --- | --- |
| Desk | Next.js app, Reown AppKit, wagmi/viem on Monad 143 / 10143 |
| Fees | Platform bps settled on Monad to `NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT` |
| Park | Aave V3 USDC supply / withdraw on Monad |
| Spot | Uniswap V3 MON ↔ USDC on Monad |
| Desk contract | OpenVenueDesk verified on Monad testnet + mainnet |
| Stock venues | Compare Anchored (Monad) + live bStocks/Ondo/xStocks; MetaMask executes on the venue chain |

## Onboarding (Monad tooling)

| Step | Notes |
| --- | --- |
| Add chain | Monad Mainnet `143` / Testnet `10143` via wallet |
| RPC | `https://rpc.monad.xyz` · `https://testnet-rpc.monad.xyz` |
| Foundry | Deploy + Sourcify verify via `https://sourcify-api-monad.blockvision.org/` |
| Time to first Monad desk call | Local `npm run dev` → `/api/venue/resolve?ticker=NVDA` |

## API / desk pitfalls (OpenVenue)

| Area | Issue | Fix |
| --- | --- | --- |
| Chart 24h volume | Nasdaq intraday bars ship `volume: 0` | Fall through to Yahoo / stamp ShareVolume |
| Park | Old Binance earn stub returned empty list | Wire Aave V3 on Monad (`/api/venue/park`) |
| Limit orders | Balance check used wrong chain/decimals | Read quote token on venue execution chain |
| Fees | Must land on Monad even if fill is elsewhere | `buildPlatformFeeCalls` after venue swap |

## Tokenized-stock notes

| Observation | Detail |
| --- | --- |
| Anchored | Live ERC-20s on Monad (e.g. aNVDA) — thin AMM liquidity today |
| bStocks | Deep USDT pools on issuer venues (e.g. NVDAB); MetaMask switches for fill |
| Ondo / xStocks | Listed where contracts + liquidity exist; compared in resolve |
| Park APY | Aave V3 USDC on Monad ~variable supply APY (DefiLlama) |

## Contracts

| Network | OpenVenueDesk |
| --- | --- |
| Monad Mainnet | `0xBdb5bDc633Dec3F7D288C1b93b775A80fFE1aD40` |
| Monad Testnet | `0xCFF046c4bCBab4f25254Fd41d94f8AcD7a3334Fa` |

## Redesign suggestions (Monad DX)

1. One-click “Add Monad” deep link in AppKit onboarding.
2. Official tokenized-equity address book on Monad as issuers list.
3. Shared Sourcify + Monadscan verify recipe in Blitz resources (already strong).

## Submission checklist

- [x] Public repo / run instructions (README)
- [x] Deployed or local MVP on Monad
- [x] Pitch + demo video
- [x] Verified contracts on Monad
- [x] Blitz team registration (Amaan Sayyad · Shivam Sharma)
