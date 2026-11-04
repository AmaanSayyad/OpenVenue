# OpenVenueDesk (Monad)

Foundry project for the OpenVenue desk ledger on **Monad**.

## Networks

| Network | Chain ID | Address |
| --- | --- | --- |
| Monad Mainnet | 143 | `0xBdb5bDc633Dec3F7D288C1b93b775A80fFE1aD40` |
| Monad Testnet | 10143 | `0xCFF046c4bCBab4f25254Fd41d94f8AcD7a3334Fa` |

See `deployments.json` for deploy txs and explorer links. Both are Sourcify-verified via `https://sourcify-api-monad.blockvision.org/`.

## What it does

- `note` / `recordTrade` — on-chain desk audit events
- `receive` / `depositFee` — accept MON fees
- `withdraw` — owner pull

Stock buys do **not** execute through this contract; fills go to issuer venues, fees settle on Monad.

## Build / verify

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge build
forge verify-contract <ADDR> src/OpenVenueDesk.sol:OpenVenueDesk \
  --chain 143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/ \
  --rpc-url https://rpc.monad.xyz
```

Use `--chain 10143` and `https://testnet-rpc.monad.xyz` for testnet.

`lib/forge-std` is an upstream Foundry dependency — leave its markdown alone.
