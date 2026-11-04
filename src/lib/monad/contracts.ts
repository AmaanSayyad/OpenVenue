import { MONAD_MAINNET_ID, MONAD_TESTNET_ID } from "./chains";

/** OpenVenueDesk - on-chain desk ledger + fee sink (verified on Sourcify). */
export const OPEN_VENUE_DESK = {
  [MONAD_MAINNET_ID]:
    "0xBdb5bDc633Dec3F7D288C1b93b775A80fFE1aD40" as const,
  [MONAD_TESTNET_ID]:
    "0xCFF046c4bCBab4f25254Fd41d94f8AcD7a3334Fa" as const,
} as const;

export function openVenueDesk(chainId: number): `0x${string}` {
  if (chainId === MONAD_MAINNET_ID) return OPEN_VENUE_DESK[MONAD_MAINNET_ID];
  return OPEN_VENUE_DESK[MONAD_TESTNET_ID];
}

export const OPEN_VENUE_DESK_ABI = [
  {
    type: "function",
    name: "note",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tag", type: "bytes32" },
      { name: "memo", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "recordTrade",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ticker", type: "bytes32" },
      { name: "venue", type: "bytes32" },
      { name: "side", type: "uint8" },
      { name: "amountUsdc", type: "uint256" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "depositFee",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "noteCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tradeCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
