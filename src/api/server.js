const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { getMarketData } = require("../agent/market");
const { makeDecision } = require("../agent/brain");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// x402 payment middleware
async function requirePayment(req, res, next) {
  const payment = req.headers["x-payment"];
  
  if (!payment) {
    return res.status(402).json({
      error: "Payment Required",
      message: "This endpoint requires x402 payment",
      accepts: [
        {
          scheme: "exact",
          network: "xlayer",
          maxAmountRequired: "1000",
          resource: req.path,
          description: "AVA trading signal",
          mimeType: "application/json",
          payTo: process.env.AGENT_WALLET_ADDRESS || "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d",
          maxTimeoutSeconds: 300,
          asset: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
          extra: {
            name: "USDT",
            version: "1"
          }
        }
      ]
    });
  }

  // Verify payment on X Layer
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const paymentData = JSON.parse(Buffer.from(payment, "base64").toString());
    const txHash = paymentData.txHash;

    if (!txHash) {
      return res.status(402).json({ error: "Invalid payment - no transaction hash" });
    }

    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt || receipt.status !== 1) {
      return res.status(402).json({ error: "Payment transaction not confirmed" });
    }

    console.log(`💰 Payment verified: ${txHash}`);
    req.paymentTx = txHash;
    next();

  } catch (error) {
    return res.status(402).json({ error: "Payment verification failed", details: error.message });
  }
}

// Free endpoint - AVA status
app.get("/", (req, res) => {
  res.json({
    name: "AVA - Autonomous Value Agent",
    description: "The first autonomous trading agent on X Layer",
    wallet: "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d",
    status: "ACTIVE",
    endpoints: {
      free: ["/", "/health"],
      paid: ["/api/signal", "/api/analysis", "/api/report"]
    },
    pricing: {
      signal: "$0.001 USDT per call",
      analysis: "$0.005 USDT per call",
      report: "$0.01 USDT per call"
    }
  });
});

// Free health check
app.get("/health", (req, res) => {
  res.json({ status: "AVA is alive and trading", timestamp: new Date().toISOString() });
});

// PAID - Basic signal
app.get("/api/signal", requirePayment, async (req, res) => {
  try {
    const marketData = await getMarketData("OKB-USDT");
    const decision = await makeDecision(marketData);

    res.json({
      signal: decision.action,
      confidence: decision.confidence,
      token: decision.token || "OKB-USDT",
      reasoning: decision.reasoning,
      timestamp: new Date().toISOString(),
      paymentTx: req.paymentTx
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PAID - Full market analysis
app.get("/api/analysis", requirePayment, async (req, res) => {
  try {
    const [okb, eth, btc] = await Promise.all([
      getMarketData("OKB-USDT"),
      getMarketData("ETH-USDT"),
      getMarketData("BTC-USDT")
    ]);

    const decision = await makeDecision([okb, eth, btc]);

    res.json({
      recommendation: decision,
      markets: { okb, eth, btc },
      timestamp: new Date().toISOString(),
      paymentTx: req.paymentTx
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PAID - Full report
app.get("/api/report", requirePayment, async (req, res) => {
  try {
    const [okb, eth, btc] = await Promise.all([
      getMarketData("OKB-USDT"),
      getMarketData("ETH-USDT"),
      getMarketData("BTC-USDT")
    ]);

    const decision = await makeDecision([okb, eth, btc]);

    res.json({
      title: "AVA Market Report",
      generated: new Date().toISOString(),
      topRecommendation: decision,
      marketOverview: {
        okb: { price: okb.price, change: okb.change24h, signal: okb.change24h > 0 ? "BULLISH" : "BEARISH" },
        eth: { price: eth.price, change: eth.change24h, signal: eth.change24h > 0 ? "BULLISH" : "BEARISH" },
        btc: { price: btc.price, change: btc.change24h, signal: btc.change24h > 0 ? "BULLISH" : "BEARISH" }
      },
      disclaimer: "AVA's signals are autonomous AI decisions. Not financial advice.",
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