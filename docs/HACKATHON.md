# Monad Blitz Mumbai · Devcon Edition

**Event:** [Monad Blitz Mumbai](https://monad.xyz/developers/hackathons) — 4 Nov 2026  
**Prize pool:** US$5,000 · **Teams:** 2–3 · **Rule:** ship a working MVP **on Monad**  
**Team:** Amaan Sayyad · Shivam Sharma

## What we shipped (OpenVenue)

OpenVenue is a **tokenized-stock desk whose home chain is Monad**.

1. **Monad-native product surface** — Explore, Trade, Portfolio, Orders, Park, Agent at `/app`
2. **OpenVenueDesk** — verified Solidity ledger + MON fee sink on Monad testnet + mainnet
3. **Fees on Monad** — every stock route settles platform fees to the configured Monad recipient
4. **Park on Monad** — one-click Aave V3 USDC supply / withdraw
5. **Live fills** — MetaMask switches to the issuer venue when needed; monetization stays on Monad

## Demo script (judges)

1. Connect wallet on **Monad Mainnet (143)**
2. Explore → pick **NVDA** → Trade → resolve best venue → Confirm in MetaMask
3. Portfolio → see MON / USDC / wrappers
4. Park → Aave V3 USDC → Park / Unpark
5. Agent → `buy $15 NVDA best venue` → Run
6. Optional: show verified desk on [MonadVision](https://monadvision.com/address/0xBdb5bDc633Dec3F7D288C1b93b775A80fFE1aD40)

## Networks to show

| Network | Chain ID | RPC |
| --- | --- | --- |
| Monad Mainnet | 143 | `https://rpc.monad.xyz` |
| Monad Testnet | 10143 | `https://testnet-rpc.monad.xyz` |

## Submission checklist

- [x] Built on Monad (desk, fees, park, contracts)
- [x] Working MVP (`npm run dev` / openvenue.xyz)
- [x] Smart contract deployed + verified (OpenVenueDesk)
- [x] Pitch / demo materials linked from README  
  - Pitch: https://app.chroniclehq.com/amaan-s-workspace/openvenue-monad  
  - Demo: https://drive.google.com/drive/folders/1TuNcIJzfz2zBeFZEqPaOEqWkbUR-vCXw?usp=sharing  
  - Tweet: https://x.com/amaanbiz/status/2117954547817828767
- [x] Team of 2–3 registered for Blitz (Amaan Sayyad · Shivam Sharma)
- [ ] Live demo for judges

## References

- Monad testnet / mainnet: https://docs.monad.xyz
- Add Monad to wallet / deploy / verify: https://blitz.devnads.com/resources
- Foundry verify (Sourcify): `https://sourcify-api-monad.blockvision.org/`
