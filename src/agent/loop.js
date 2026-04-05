const { getMarketData } = require("./market");
const { makeDecision } = require("./brain");
const { executeSwap, ensureNOVADelegation } = require("./executor");
const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

let isRunning = false;
let cycleCount = 0;
let holdCount = 0;

const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
const WETH_ADDRESS = "0x5A77f1443D16ee5761d310e38b62f77f726bC71c";
const WOKB_ADDRESS = "0xe538905cf8410324e03a5a23c1c177a474d59b2b";
const NOVA_WALLET = "0x93fa3CF2841502e3B31f8A2F1817223Ea5E08213";
const AVA_WALLET = "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d";
const NOVA_API = "https://ava-autonomous-agent-production.up.railway.app";

const CRITICAL_GAS_THRESHOLD = ethers.parseEther("0.04");
const RESCUE_AMOUNT = ethers.parseEther("0.01");

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

async function getOKBPrice() {
  try {
    const response = await axios.get("https://okx.com/api/v5/market/ticker?instId=OKB-USDT");
    return parseFloat(response.data.data[0].last);
  } catch (e) {
    console.log("⚠️ OKB price fetch failed:", e.message);
    return 83; // fallback price
  }
}

async function getWalletBalances() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
  const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
  const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);
  const wokb = new ethers.Contract(WOKB_ADDRESS, ERC20_ABI, provider);
  const [usdtBal, wethBal, wokbBal] = await Promise.all([
    usdt.balanceOf(wallet.address),
    weth.balanceOf(wallet.address),
    wokb.balanceOf(wallet.address)
  ]);
  return {
    usdt: parseFloat(ethers.formatUnits(usdtBal, 6)),
    weth: parseFloat(ethers.formatEther(wethBal)),
    wokb: parseFloat(ethers.formatEther(wokbBal)),
    address: wallet.address
  };
}

async function checkAndRequestGasRescue(wallet, provider) {
  try {
    const avaGas = await provider.getBalance(AVA_WALLET);
    const avaGasFormatted = parseFloat(ethers.formatEther(avaGas)).toFixed(4);
    
    if (avaGas >= CRITICAL_GAS_THRESHOLD) {
      console.log(`⛽ AVA Gas Check: ${avaGasFormatted} OKB — HEALTHY`);
      return;
    }

    console.log(`🚨 SHGR: AVA OKB low (${avaGasFormatted})! Requesting rescue from NOVA...`);

    // Step 1 — Hit NOVA's gas rescue endpoint (expect 402)
    try {
      await axios.post(`${NOVA_API}/api/gas-rescue`, {
        requester: AVA_WALLET,
        amount: "0.01"
      });
    } catch (error) {
      if (error.response?.status === 402) {
        console.log("📋 SHGR: NOVA requires repayment proof — preparing x402...");
      }
    }

    // Step 2 — Get OKB price for repayment calculation
    const okbPrice = await getOKBPrice();
    const repaymentUSDT = (0.01 * okbPrice).toFixed(6);
    console.log(`💱 OKB Price: $${okbPrice} | Repayment: ${repaymentUSDT} USDT`);

    // Step 3 — Send USDT repayment to NOVA first (x402)
    console.log(`💸 SHGR: Sending ${repaymentUSDT} USDT to NOVA as repayment...`);
    const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, wallet);
    const repaymentAmount = ethers.parseUnits(repaymentUSDT, 6);
    const repayTx = await usdt.transfer(NOVA_WALLET, repaymentAmount);
    await repayTx.wait();
    console.log(`✅ SHGR: Repayment sent! TX: ${repayTx.hash}`);

    // Step 4 — Notify NOVA with payment proof to release OKB rescue
    const paymentProof = Buffer.from(JSON.stringify({
      txHash: repayTx.hash,
      amount: repaymentUSDT,
      asset: USDT_ADDRESS,
      network: "xlayer",
      from: AVA_WALLET,
      to: NOVA_WALLET,
      reason: "gas_rescue_repayment"
    })).toString("base64");

    const rescueResponse = await axios.post(`${NOVA_API}/api/gas-rescue/confirm`, {
      requester: AVA_WALLET,
      rescueAmount: "0.01",
      paymentProof
    });

    console.log(`🩹 SHGR: NOVA sending 0.01 OKB rescue...`);
    console.log(`✅ SHGR: Gas restored! TX: ${rescueResponse.data?.txHash}`);
    console.log(`💚 SHGR: AVA-NOVA Symbiosis — agents keeping each other alive!`);

  } catch (e) {
    console.log("⚠️ SHGR gas rescue failed:", e.message);
  }
}

async function runCycle() {
  cycleCount++;
  console.log(`\n🔄 AVA Cycle #${cycleCount} - ${new Date().toISOString()}`);
  console.log("─────────────────────────────────────");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

    // Auto-renew NOVA delegation every cycle
    await ensureNOVADelegation(wallet, provider);

    // SHGR — AVA checks her own gas
    await checkAndRequestGasRescue(wallet, provider);

    const balances = await getWalletBalances();
    console.log(`💰 Balances: ${balances.usdt} USDT | ${balances.weth.toFixed(6)} WETH | ${balances.wokb.toFixed(4)} WOKB`);

    if (balances.usdt < 2 && balances.weth > 0.0001) {
      console.log("⚠️  Low USDT — selling WETH back to USDT...");
      const sellDecision = {
        action: "SELL",
        confidence: 0.8,
        reasoning: "Low USDT balance — converting WETH back to USDT",
        token: "ETH-USDT",
        amount_usdt: 1
      };
      await executeSwap(sellDecision, null);
      holdCount = 0;
      return;
    }

    if (balances.usdt < 2 && balances.wokb > 0.01) {
      console.log("⚠️  Low USDT — selling WOKB back to USDT...");
      const sellDecision = {
        action: "SELL",
        confidence: 0.8,
        reasoning: "Low USDT balance — converting WOKB back to USDT",
        token: "OKB-USDT",
        amount_usdt: balances.wokb * 85 * 0.5
      };
      await executeSwap(sellDecision, null);
      holdCount = 0;
      return;
    }

    console.log("👀 Fetching market data...");
    const marketData = await getMarketData("ETH-USDT");

    console.log("🧠 Thinking...");
    const decision = await makeDecision(marketData, holdCount);

    if (decision.confidence >= 0.45 && decision.action !== "HOLD") {
      console.log(`⚡ Executing ${decision.action} with ${decision.confidence * 100}% confidence`);
      const txHash = await executeSwap(decision, marketData);
      if (txHash) {
        console.log(`✅ Trade complete! TX: ${txHash}`);
        holdCount = 0;
      }
    } else {
      holdCount++;
      console.log(`⏸️  Holding - action: ${decision.action}, confidence: ${decision.confidence * 100}%`);
      console.log(`📊 Hold count: ${holdCount}/3`);

      if (holdCount >= 3) {
        console.log("⚡ Demo Mode: 3 consecutive HOLDs — forcing trade");
        const balances2 = await getWalletBalances();
        const forcedDecision = {
          action: balances2.usdt >= 1 ? "BUY" : "SELL",
          confidence: 0.8,
          reasoning: "Demo Mode: Forced micro-scalp to keep trading loop active",
          selfEvaluation: "Forced trade after 3 consecutive HOLDs to demonstrate autonomous loop",
          riskLevel: "LOW",
          token: "ETH-USDT",
          amount_usdt: 1
        };
        console.log(`🤖 Forced ${forcedDecision.action} to demonstrate loop`);
        const txHash = await executeSwap(forcedDecision, marketData);
        if (txHash) {
          console.log(`✅ Forced trade complete! TX: ${txHash}`);
        }
        holdCount = 0;
      }
    }

  } catch (error) {
    console.error("❌ Cycle error:", error.message);
  }
}

async function startAgent() {
  console.log("🤖 AVA - Autonomous Value Agent");
  console.log("================================");
  console.log("Starting autonomous trading loop...");
  console.log("Cycle interval: 5 minutes");
  console.log("Press Ctrl+C to stop\n");

  isRunning = true;
  await runCycle();

  const interval = setInterval(async () => {
    if (isRunning) await runCycle();
  }, 5 * 60 * 1000);

  process.on("SIGINT", () => {
    console.log("\n\n👋 AVA shutting down gracefully...");
    isRunning = false;
    clearInterval(interval);
    process.exit(0);
  });
}

startAgent();