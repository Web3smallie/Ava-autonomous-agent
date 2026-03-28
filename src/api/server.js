const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { getMarketData } = require("../agent/market");
const { makeDecision } = require("../agent/brain");
require("dotenv").config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

const REPUTATION_ABI = ["function getSignalPrice() public view returns (uint256)"];
const REPUTATION_CONTRACT = "0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C";

// Cache decision to avoid hitting Claude API on every request
let cachedDecision = null;
let lastDecisionTime = 0;
const DECISION_CACHE_MS = 5 * 60 * 1000; // 5 minutes

let avaState = {
  lastDecision: null,
  lastTrade: null,
  tradeCount: 0,
  status: "ACTIVE"
};

app.updateState = (decision, trade) => {
  if (decision) avaState.lastDecision = decision;
  if (trade) {
    avaState.lastTrade = trade;
    avaState.tradeCount++;
  }
};

async function getCachedDecision() {
  const now = Date.now();
  if (!cachedDecision || now - lastDecisionTime > DECISION_CACHE_MS) {
    try {
      const marketData = await getMarketData("ETH-USDT");
      cachedDecision = await makeDecision(marketData);
      lastDecisionTime = now;
      console.log("🔄 Decision cache refreshed");
    } catch (e) {
      console.log("⚠️ Using previous cached decision:", e.message);
    }
  }
  return cachedDecision;
}

async function getDynamicPrice() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const reputation = new ethers.Contract(REPUTATION_CONTRACT, REPUTATION_ABI, provider);
    const price = await reputation.getSignalPrice();
    console.log(`💰 Dynamic signal price: ${price.toString()} microUSDT`);
    return price.toString();
  } catch (e) {
    console.log("⚠️ Using base price:", e.message);
    return "1000";
  }
}

async function requirePayment(req, res, next) {
  const payment = req.headers["x-payment"];
  if (!payment) {
    const price = await getDynamicPrice();
    return res.status(402).json({
      error: "Payment Required",
      message: "This endpoint requires x402 payment",
      accepts: [{
        scheme: "exact",
        network: "xlayer",
        maxAmountRequired: price,
        resource: req.path,
        description: "AVA trading signal",
        mimeType: "application/json",
        payTo: "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d",
        maxTimeoutSeconds: 300,
        asset: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
        extra: { name: "USDT", version: "1" }
      }]
    });
  }
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const paymentData = JSON.parse(Buffer.from(payment, "base64").toString());
    const txHash = paymentData.txHash;
    if (!txHash) return res.status(402).json({ error: "Invalid payment" });
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) return res.status(402).json({ error: "Payment not confirmed" });
    console.log(`💰 Payment verified: ${txHash}`);
    req.paymentTx = txHash;
    next();
  } catch (error) {
    return res.status(402).json({ error: "Payment verification failed" });
  }
}

app.get("/", (req, res) => {
  res.json({
    name: "AVA - Autonomous Value Agent",
    description: "The first autonomous trading agent on X Layer",
    wallet: "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d",
    free: ["/", "/health", "/api/status", "/api/reputation"],
    paid: ["/api/signal", "/api/analysis", "/api/report"],
    pricing: { signal: "Dynamic — based on AVA's onchain reputation", analysis: "$0.005 USDT per call" }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "AVA is alive and trading", timestamp: new Date().toISOString() });
});

app.get("/api/status", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const USDT = new ethers.Contract(
      "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
      ["function balanceOf(address) view returns (uint256)"],
      provider
    );
    const balance = await USDT.balanceOf("0x00EdD1bE53767fD3e59F931B509176c7F50eC14d");
    const usdt = parseFloat(ethers.formatUnits(balance, 6)).toFixed(2);

    const decision = await getCachedDecision();

    res.json({
      status: "ACTIVE",
      wallet: "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d",
      network: "X Layer",
      balance: { usdt },
      lastDecision: decision,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      status: "ACTIVE",
      wallet: "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d",
      network: "X Layer",
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/api/reputation", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const FULL_REPUTATION_ABI = [
      "function getReputation() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
      "function getSignalPrice() public view returns (uint256)"
    ];
    const reputation = new ethers.Contract(REPUTATION_CONTRACT, FULL_REPUTATION_ABI, provider);
    const data = await reputation.getReputation();
    const price = await reputation.getSignalPrice();

    res.json({
      totalTrades: data[0].toString(),
      successfulTrades: data[1].toString(),
      successRate: data[2].toString() + "%",
      totalEarned: ethers.formatUnits(data[3], 6) + " USDT",
      totalLost: ethers.formatUnits(data[4], 6) + " USDT",
      signalsSold: data[5].toString(),
      totalSignalRevenue: ethers.formatUnits(data[6], 6) + " USDT",
      currentSignalPrice: ethers.formatUnits(price, 6) + " USDT",
      lastUpdated: new Date(Number(data[8]) * 1000).toISOString(),
      contract: REPUTATION_CONTRACT
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/signal", requirePayment, async (req, res) => {
  try {
    const decision = await getCachedDecision();
    res.json({
      signal: decision.action,
      confidence: decision.confidence,
      token: "ETH-USDT",
      reasoning: decision.reasoning,
      selfEvaluation: decision.selfEvaluation,
      riskLevel: decision.riskLevel,
      timestamp: new Date().toISOString(),
      paymentTx: req.paymentTx
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/analysis", requirePayment, async (req, res) => {
  try {
    const marketData = await getMarketData("ETH-USDT");
    const decision = await getCachedDecision();
    res.json({ recommendation: decision, market: marketData, timestamp: new Date().toISOString(), paymentTx: req.paymentTx });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/report", requirePayment, async (req, res) => {
  try {
    const decision = await getCachedDecision();
    res.json({
      title: "AVA Market Report",
      generated: new Date().toISOString(),
      recommendation: decision,
      disclaimer: "AVA signals are autonomous AI decisions. Not financial advice.",
      paymentTx: req.paymentTx
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n💰 AVA Signal Server running on port ${PORT}`);
  console.log(`📡 Free endpoints: http://localhost:${PORT}/`);
  console.log(`🔒 Paid endpoints require x402 payment`);
  console.log(`💳 Payment address: 0x00EdD1bE53767fD3e59F931B509176c7F50eC14d\n`);
});

module.exports = app;