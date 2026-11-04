/**
 * Live buy→sell probe across NVDA venues (bStocks / xStocks / Ondo / Anchored).
 * Usage: PRIVATE_KEY=0x… BASE_URL=http://localhost:3000 node scripts/e2e-all-routes.mjs
 *
 * Never logs the private key. Spends ~1 USDT per BSC route (+ gas) and ~1 USDC on Monad if funded.
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatEther,
  formatUnits,
  erc20Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";

const PK = process.env.PRIVATE_KEY;
if (!PK) {
  console.error("Set PRIVATE_KEY");
  process.exit(1);
}

const BASE = process.env.BASE_URL || "http://localhost:3000";
const BUY_USDT = process.env.BUY_USDT || "1";
const BUY_USDC = process.env.BUY_USDC || "1";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const BSC_RPC = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";
const MONAD_RPC = "https://rpc.monad.xyz";

const monad = {
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC] } },
};

const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const bscPublic = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
const bscWallet = createWalletClient({
  account,
  chain: bsc,
  transport: http(BSC_RPC),
});
const monadPublic = createPublicClient({
  chain: monad,
  transport: http(MONAD_RPC),
});
const monadWallet = createWalletClient({
  account,
  chain: monad,
  transport: http(MONAD_RPC),
});

const results = [];

function log(...args) {
  console.log(...args);
}

async function api(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function balances() {
  const [usdt, bnb, usdc, mon] = await Promise.all([
    bscPublic.readContract({
      address: USDT,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    bscPublic.getBalance({ address: account.address }),
    monadPublic.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    monadPublic.getBalance({ address: account.address }),
  ]);
  return {
    usdt: formatUnits(usdt, 18),
    bnb: formatEther(bnb),
    usdc: formatUnits(usdc, 6),
    mon: formatEther(mon),
    usdtWei: usdt,
    usdcWei: usdc,
    bnbWei: bnb,
    monWei: mon,
  };
}

async function sendBuiltTx(chainId, tx) {
  const publicClient = chainId === 56 ? bscPublic : monadPublic;
  const wallet = chainId === 56 ? bscWallet : monadWallet;
  const hash = await wallet.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value && tx.value !== "0" ? BigInt(tx.value) : undefined,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, status: receipt.status };
}

async function tokenBal(chainId, token, decimals) {
  const publicClient = chainId === 56 ? bscPublic : monadPublic;
  const bal = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  return { wei: bal, human: formatUnits(bal, decimals) };
}

async function runVenue(quote) {
  const c = quote.candidate;
  const r = quote.route;
  const symbol = c.symbol;
  const chainId = Number(r.executionChainId || c.executionChainId);
  const label = `${c.platform} · ${symbol} · chain ${chainId}`;
  log(`\n=== ${label} ===`);

  if (!quote.ok || !r?.quoteId) {
    results.push({ label, buy: "SKIP", sell: "SKIP", note: quote.error || "no quote" });
    return;
  }

  const isBsc = chainId === 56;
  const amount = isBsc ? BUY_USDT : BUY_USDC;
  const quoteDecimals = c.quoteDecimals ?? (isBsc ? 18 : 6);
  const stockDecimals = 18;
  const quoteToken = c.quoteToken;
  const stock = c.contractAddress;

  const bal = await balances();
  if (isBsc) {
    if (bal.usdtWei < parseUnits(amount, 18)) {
      results.push({ label, buy: "SKIP", sell: "SKIP", note: `need ≥${amount} USDT on BSC (have ${bal.usdt})` });
      return;
    }
    if (bal.bnbWei < parseUnits("0.0005", 18)) {
      results.push({ label, buy: "SKIP", sell: "SKIP", note: "need BNB for gas" });
      return;
    }
  } else {
    if (bal.usdcWei < parseUnits(amount, 6)) {
      results.push({ label, buy: "SKIP", sell: "SKIP", note: `need ≥${amount} USDC on Monad (have ${bal.usdc})` });
      return;
    }
    if (bal.monWei < parseUnits("0.05", 18)) {
      results.push({ label, buy: "SKIP", sell: "SKIP", note: "need MON for gas" });
      return;
    }
  }

  const before = await tokenBal(chainId, stock, stockDecimals);

  const amountWei = parseUnits(amount, quoteDecimals).toString();

  async function buildSwapBody(route, from, to, amtWei) {
    return {
      quoteId: route.quoteId,
      vendor: route.vendorName,
      executionMode: route.executionMode,
      fromTokenAddress: from,
      toTokenAddress: to,
      amount: amtWei,
      userWalletAddress: account.address,
      slippagePercent: "3",
      executionChainId: chainId,
      simulate: chainId !== 56,
      requireSimOk: false,
    };
  }

  // BUY
  let buildBuy = await api("/api/venue/build", {
    method: "POST",
    body: JSON.stringify(await buildSwapBody(r, quoteToken, stock, amountWei)),
  });
  if (!buildBuy.json?.ok) {
    const again = await api(
      `/api/venue/resolve?ticker=NVDA&amount=${amount}&side=buy&wallet=${account.address}`,
    );
    const match = (again.json?.decision?.quotes || []).find(
      (q) => q.candidate?.symbol === symbol && q.ok,
    );
    if (!match?.route) {
      results.push({
        label,
        buy: "FAIL",
        sell: "SKIP",
        note: buildBuy.json?.error || "rebuild miss",
      });
      return;
    }
    buildBuy = await api("/api/venue/build", {
      method: "POST",
      body: JSON.stringify(
        await buildSwapBody(match.route, quoteToken, stock, amountWei),
      ),
    });
  }

  if (!buildBuy.json?.ok) {
    results.push({
      label,
      buy: "FAIL",
      sell: "SKIP",
      note: buildBuy.json?.error || `build ${buildBuy.status}`,
    });
    return;
  }

  try {
    const approveTx = buildBuy.json.approve;
    if (approveTx?.to && approveTx?.data && buildBuy.json.allowancePending) {
      log("  approve quote asset…");
      const { hash, status } = await sendBuiltTx(chainId, approveTx);
      log("  approve tx", hash, status);
      if (status !== "success") throw new Error("approve reverted");
    }

    const tx = buildBuy.json.swap?.tx;
    if (!tx?.to || !tx?.data) throw new Error("swap tx missing");
    log("  buy…");
    const buyRes = await sendBuiltTx(chainId, tx);
    log("  buy tx", buyRes.hash, buyRes.status);
    if (buyRes.status !== "success") throw new Error("buy reverted");

    const afterBuy = await tokenBal(chainId, stock, stockDecimals);
    const bought = afterBuy.wei - before.wei;
    log(`  stock Δ +${formatUnits(bought, stockDecimals)}`);
    if (bought <= 0n) throw new Error("no stock received");

    // SELL what we just bought (use full token balance for this wrapper)
    const sellAmt = afterBuy.wei;
    const sellHuman = formatUnits(sellAmt, stockDecimals);
    const resolveSell = await api(
      `/api/venue/resolve?ticker=NVDA&amount=${encodeURIComponent(sellHuman)}&side=sell&wallet=${account.address}&fromToken=${stock}&fromAmountWei=${sellAmt.toString()}`,
    );
    const sellQuote =
      (resolveSell.json?.decision?.quotes || []).find(
        (q) => q.candidate?.symbol === symbol && q.ok,
      ) || resolveSell.json?.decision?.bestQuote;

    if (!sellQuote?.route?.quoteId) {
      results.push({
        label,
        buy: "OK",
        buyHash: buyRes.hash,
        sell: "FAIL",
        note: "no sell quote",
        held: afterBuy.human,
      });
      return;
    }

    const buildSell = await api("/api/venue/build", {
      method: "POST",
      body: JSON.stringify(
        await buildSwapBody(
          sellQuote.route,
          stock,
          quoteToken,
          sellAmt.toString(),
        ),
      ),
    });
    if (!buildSell.json?.ok) {
      results.push({
        label,
        buy: "OK",
        buyHash: buyRes.hash,
        sell: "FAIL",
        note: buildSell.json?.error || "sell build failed",
        held: afterBuy.human,
      });
      return;
    }

    const sellApprove = buildSell.json.approve;
    if (
      sellApprove?.to &&
      sellApprove?.data &&
      buildSell.json.allowancePending
    ) {
      log("  approve stock…");
      const { hash, status } = await sendBuiltTx(chainId, sellApprove);
      log("  stock approve", hash, status);
      if (status !== "success") throw new Error("stock approve reverted");
    }

    const sellTx = buildSell.json.swap?.tx;
    if (!sellTx?.to || !sellTx?.data) throw new Error("sell tx missing");
    log("  sell…");
    const sellRes = await sendBuiltTx(chainId, sellTx);
    log("  sell tx", sellRes.hash, sellRes.status);
    if (sellRes.status !== "success") throw new Error("sell reverted");

    const afterSell = await tokenBal(chainId, stock, stockDecimals);
    results.push({
      label,
      buy: "OK",
      buyHash: buyRes.hash,
      sell: "OK",
      sellHash: sellRes.hash,
      bought: formatUnits(bought, stockDecimals),
      left: afterSell.human,
    });
  } catch (err) {
    results.push({
      label,
      buy: "FAIL",
      sell: "SKIP",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

async function main() {
  log("wallet", account.address);
  const bal0 = await balances();
  log("balances", {
    "BSC USDT": bal0.usdt,
    BNB: bal0.bnb,
    "Monad USDC": bal0.usdc,
    MON: bal0.mon,
  });

  const { json } = await api(
    `/api/venue/resolve?ticker=NVDA&amount=${BUY_USDT}&side=buy&wallet=${account.address}`,
  );
  if (!json?.ok) throw new Error(json?.error || "resolve failed");
  const quotes = json.decision?.quotes || [];
  log(
    "routes",
    quotes.map((q) => ({
      symbol: q.candidate?.symbol,
      ok: q.ok,
      vendor: q.route?.vendorName,
      out: q.outAmountHuman,
    })),
  );

  const only = (process.env.ONLY_SYMBOLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const q of quotes) {
    if (only.length && !only.includes(q.candidate?.symbol)) {
      log(`\n=== skip ${q.candidate?.symbol} (ONLY_SYMBOLS) ===`);
      continue;
    }
    await runVenue(q);
  }

  const bal1 = await balances();
  log("\n=== SUMMARY ===");
  for (const r of results) {
    log(
      `${r.label}: buy=${r.buy} sell=${r.sell}${r.note ? ` · ${r.note}` : ""}${r.buyHash ? ` · buy ${r.buyHash}` : ""}${r.sellHash ? ` · sell ${r.sellHash}` : ""}`,
    );
  }
  log("balances after", {
    "BSC USDT": bal1.usdt,
    BNB: bal1.bnb,
    "Monad USDC": bal1.usdc,
    MON: bal1.mon,
  });

  const failed = results.filter((r) => r.buy === "FAIL" || r.sell === "FAIL");
  if (failed.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
