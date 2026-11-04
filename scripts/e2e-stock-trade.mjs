/**
 * E2E: buy ~1 USDT of NVDAB on BSC via Pancake, then pay OpenVenue fee on Monad.
 * Usage: PRIVATE_KEY=0x... node scripts/e2e-stock-trade.mjs
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatEther,
  formatUnits,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";

const PK = process.env.PRIVATE_KEY;
if (!PK) {
  console.error("Set PRIVATE_KEY");
  process.exit(1);
}

const USDT = "0x55d398326f99059fF775485246999027B3197955";
const NVDAB = "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436";
const ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const FEE_TO =
  process.env.NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT ||
  "0xe9BEa05Fc2927d1A2Ef6BD59B1d492d42965896e";
const MONAD_RPC = "https://rpc.monad.xyz";
const BSC_RPC = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";

const routerAbi = [
  {
    type: "function",
    name: "getAmountsOut",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
];

const monad = {
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC] } },
};

const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const bscPublic = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
const bscWallet = createWalletClient({
  account,
  chain: bsc,
  transport: http(BSC_RPC),
});
const monadPublic = createPublicClient({ chain: monad, transport: http(MONAD_RPC) });
const monadWallet = createWalletClient({
  account,
  chain: monad,
  transport: http(MONAD_RPC),
});

const amountIn = parseUnits("1", 18); // 1 USDT

async function main() {
  console.log("wallet", account.address);

  const usdtBal = await bscPublic.readContract({
    address: USDT,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const bnb = await bscPublic.getBalance({ address: account.address });
  console.log("BSC USDT", formatUnits(usdtBal, 18), "BNB", formatEther(bnb));
  if (usdtBal < amountIn) throw new Error("Need ≥1 USDT on BSC");
  if (bnb < parseUnits("0.001", 18)) throw new Error("Need BNB for gas");

  const amounts = await bscPublic.readContract({
    address: ROUTER,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: [amountIn, [USDT, NVDAB]],
  });
  const out = amounts[1];
  console.log("quote out NVDAB", formatUnits(out, 18));

  const allowance = await bscPublic.readContract({
    address: USDT,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, ROUTER],
  });
  if (allowance < amountIn) {
    console.log("approving USDT…");
    const ah = await bscWallet.writeContract({
      address: USDT,
      abi: erc20Abi,
      functionName: "approve",
      args: [ROUTER, maxUint256],
    });
    await bscPublic.waitForTransactionReceipt({ hash: ah });
    console.log("approve", ah);
  }

  const minOut = (out * 985n) / 1000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  console.log("swapping…");
  const sh = await bscWallet.writeContract({
    address: ROUTER,
    abi: routerAbi,
    functionName: "swapExactTokensForTokens",
    args: [amountIn, minOut, [USDT, NVDAB], account.address, deadline],
  });
  const receipt = await bscPublic.waitForTransactionReceipt({ hash: sh });
  console.log("swap", sh, "status", receipt.status);

  const nvdab = await bscPublic.readContract({
    address: NVDAB,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("NVDAB held", formatUnits(nvdab, 18));

  // 15 bps of $1 = $0.0015 → MON at $0.03 ≈ 0.05 MON (use floor 0.01 MON)
  const feeWei = parseUnits("0.01", 18);
  const before = await monadPublic.getBalance({ address: FEE_TO });
  console.log("paying Monad fee to", FEE_TO);
  const fh = await monadWallet.sendTransaction({
    to: FEE_TO,
    value: feeWei,
  });
  await monadPublic.waitForTransactionReceipt({ hash: fh });
  const after = await monadPublic.getBalance({ address: FEE_TO });
  console.log("fee tx", fh);
  console.log("fee wallet MON", formatEther(before), "→", formatEther(after));
  console.log("OK e2e stock buy + Monad fee");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
