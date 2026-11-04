/**
 * E2E: acquire a little USDC on Monad, supply to Aave V3, then withdraw.
 * PRIVATE_KEY=0x... node scripts/e2e-park.mjs
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PK = process.env.PRIVATE_KEY;
if (!PK) {
  console.error("Set PRIVATE_KEY");
  process.exit(1);
}

const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";
const SWAP_ROUTER_02 = "0xfe31f71c1b106eac32f1a19239c9a9a72ddfb900";
const AAVE_POOL = "0x69a5F9AD4f96ebf0a0C792dD42a01cC5C0102fef";
const AUSDC = "0x35a73BAcb179d3740395A3ceCc87FF2e581d6042";

const monad = {
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
};

const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const publicClient = createPublicClient({
  chain: monad,
  transport: http("https://rpc.monad.xyz"),
});
const wallet = createWalletClient({
  account,
  chain: monad,
  transport: http("https://rpc.monad.xyz"),
});

const swapRouterAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);
const aaveAbi = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
]);
const wmonAbi = parseAbi(["function deposit() payable"]);

async function ensureUsdc(minHuman = "0.05") {
  const min = parseUnits(minHuman, 6);
  let bal = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("USDC", formatUnits(bal, 6));
  if (bal >= min) return bal;

  const spend = parseEther("3");
  console.log("wrap 3 MON → WMON");
  let h = await wallet.writeContract({
    address: WMON,
    abi: wmonAbi,
    functionName: "deposit",
    value: spend,
  });
  await publicClient.waitForTransactionReceipt({ hash: h });
  h = await wallet.writeContract({
    address: WMON,
    abi: erc20Abi,
    functionName: "approve",
    args: [SWAP_ROUTER_02, spend],
  });
  await publicClient.waitForTransactionReceipt({ hash: h });

  for (const fee of [500, 3000, 100, 10000]) {
    try {
      console.log("swap WMON→USDC fee", fee);
      h = await wallet.writeContract({
        address: SWAP_ROUTER_02,
        abi: swapRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: WMON,
            tokenOut: USDC,
            fee,
            recipient: account.address,
            amountIn: spend,
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      bal = await publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      });
      console.log("USDC after", formatUnits(bal, 6), h);
      if (bal >= min) return bal;
    } catch (e) {
      console.log("fee failed", fee, String(e.message || e).slice(0, 160));
    }
  }
  throw new Error("Could not acquire USDC for park test");
}

async function main() {
  console.log("wallet", account.address);
  let usdc = await ensureUsdc("0.05");
  const parkAmt = usdc > parseUnits("0.2", 6) ? parseUnits("0.1", 6) : usdc / 2n;
  if (parkAmt <= 0n) throw new Error("USDC too low");
  console.log("parking", formatUnits(parkAmt, 6), "USDC to Aave");

  const allowance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, AAVE_POOL],
  });
  if (allowance < parkAmt) {
    const ah = await wallet.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [AAVE_POOL, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash: ah });
    console.log("approve", ah);
  }

  const sh = await wallet.writeContract({
    address: AAVE_POOL,
    abi: aaveAbi,
    functionName: "supply",
    args: [USDC, parkAmt, account.address, 0],
  });
  await publicClient.waitForTransactionReceipt({ hash: sh });
  console.log("supply", sh);

  const aBal = await publicClient.readContract({
    address: AUSDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("aMonUSDC", formatUnits(aBal, 6));

  const wh = await wallet.writeContract({
    address: AAVE_POOL,
    abi: aaveAbi,
    functionName: "withdraw",
    args: [USDC, maxUint256, account.address],
  });
  await publicClient.waitForTransactionReceipt({ hash: wh });
  console.log("withdraw", wh);

  const finalUsdc = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  const finalA = await publicClient.readContract({
    address: AUSDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log("final USDC", formatUnits(finalUsdc, 6), "aMonUSDC", formatUnits(finalA, 6));
  console.log("OK park e2e");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
