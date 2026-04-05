const { getMarketData } = require("./market");
const { makeDecision } = require("./brain");
const { executeSwap, ensureNOVADelegation } = require("./executor");
const { ethers } = require("ethers");
require("dotenv").config();

let isRunning = false;
let cycleCount = 0;
let holdCount = 0;

const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
const WETH_ADDRESS = "0x5A77f1443D16ee5761d310e38b62f77f726bC71c";
const WOKB_ADDRESS = "0xe538905cf8410324e03a5a23c1c177a474d59b2b";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

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

async function runCycle() {
  cycleCount++;
  console.log(`\n🔄 AVA Cycle #${cycleCount} - ${new Date().toISOString()}`);
  console.log("─────────────────────────────────────");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

    // Auto-renew NOVA delegation every cycle
    await ensureNOVADelegation(wallet, provider);

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