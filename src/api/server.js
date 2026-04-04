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

const REPUTATION_CONTRACT = "0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C";
const REGISTRY_CONTRACT = "0xD0789D963E57aAc39F57BbA3b476207f0D61c5dc";

const REPUTATION_ABI = ["function getSignalPrice() public view returns (uint256)"];

const REGISTRY_ABI = [
  "function registerAgent(string name, string description, string apiEndpoint, string capabilities) external",
  "function getAgent(address wallet) external view returns (string, string, string, string, uint256, uint256, bool, uint256, uint256)",
  "function getAllAgents() external view returns (address[])",
  "function getActiveAgents() external view returns (address[])",
  "function recordInteraction(address targetAgent) external",
  "function updateReputation(address agent, uint256 score) external"
];

// Live activity log
const activityLog = [];
const originalLog = console.log;
console.log = (...args) => {
  originalLog(...args);
  const message = args.join(' ');
  activityLog.unshift({ message, timestamp: new Date().toISOString() });
  if (activityLog.length > 200) activityLog.pop();
};

// Cache
let cachedDecision = null;
let lastDecisionTime = 0;
const DECISION_CACHE_MS = 15 * 60 * 1000;

app.updateState = (decision, trade) => {};

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
    return price.toString();
  } catch (e) {
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

// ============================================
// EXISTING ENDPOINTS
// ============================================

app.get("/", (req, res) => {
  res.json({
    name: "AVA - Autonomous Value Agent",
    description: "The first autonomous trading agent on X Layer with open agent network",
    wallet: "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d",
    free: ["/", "/health", "/api/status", "/api/reputation", "/api/logs", "/api/network/agents", "/api/network/discover"],
    paid: ["/api/signal", "/api/analysis", "/api/report", "/api/network/buy"],
    network: "/api/network/agents",
    pricing: { signal: "Dynamic — based on AVA's onchain reputation" }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "AVA is alive and trading", timestamp: new Date().toISOString() });
});

app.get("/api/logs", (req, res) => {
  res.json({ logs: activityLog, total: activityLog.length, timestamp: new Date().toISOString() });
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
    res.json({ status: "ACTIVE", wallet: "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d", network: "X Layer", timestamp: new Date().toISOString() });
  }
});

app.get("/api/reputation", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const FULL_ABI = [
      "function getReputation() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
      "function getSignalPrice() public view returns (uint256)"
    ];
    const reputation = new ethers.Contract(REPUTATION_CONTRACT, FULL_ABI, provider);
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

// ============================================
// AVA AGENT NETWORK + PAYMENT RAIL
// ============================================

// GET all registered agents
app.get("/api/network/agents", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const registry = new ethers.Contract(REGISTRY_CONTRACT, REGISTRY_ABI, provider);
    const addresses = await registry.getActiveAgents();
    const agents = [];

    for (const addr of addresses) {
      try {
        const data = await registry.getAgent(addr);
        agents.push({
          address: addr,
          name: data[0],
          description: data[1],
          apiEndpoint: data[2],
          capabilities: data[3].split(","),
          registeredAt: new Date(Number(data[4]) * 1000).toISOString(),
          lastActiveAt: new Date(Number(data[5]) * 1000).toISOString(),
          isActive: data[6],
          totalInteractions: Number(data[7]),
          reputationScore: Number(data[8])
        });
      } catch (e) {
        console.log(`⚠️ Could not fetch agent ${addr}`);
      }
    }

    console.log(`🌐 Network: ${agents.length} agents discovered`);
    res.json({
      network: "AVA Agent Network",
      totalAgents: agents.length,
      agents,
      registry: REGISTRY_CONTRACT,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET discover agents by capability
app.get("/api/network/discover", async (req, res) => {
  try {
    const { capability } = req.query;
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const registry = new ethers.Contract(REGISTRY_CONTRACT, REGISTRY_ABI, provider);
    const addresses = await registry.getActiveAgents();
    const agents = [];

    for (const addr of addresses) {
      try {
        const data = await registry.getAgent(addr);
        const capabilities = data[3].split(",");
        if (!capability || capabilities.includes(capability)) {
          agents.push({
            address: addr,
            name: data[0],
            description: data[1],
            apiEndpoint: data[2],
            capabilities,
            reputationScore: Number(data[8]),
            totalInteractions: Number(data[7])
          });
        }
      } catch (e) {}
    }

    res.json({
      query: capability || "all",
      results: agents.length,
      agents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST register any agent on the network
app.post("/api/network/register", async (req, res) => {
  try {
    const { name, description, apiEndpoint, capabilities, privateKey } = req.body;

    if (!name || !apiEndpoint || !privateKey) {
      return res.status(400).json({ error: "name, apiEndpoint and privateKey required" });
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const registry = new ethers.Contract(REGISTRY_CONTRACT, REGISTRY_ABI, wallet);

    const capString = Array.isArray(capabilities) ? capabilities.join(",") : (capabilities || "agent");

    const tx = await registry.registerAgent(name, description || "", apiEndpoint, capString);
    await tx.wait();

    console.log(`🌐 New agent registered: ${name} at ${apiEndpoint}`);
    res.json({
      success: true,
      message: `${name} successfully registered on AVA Agent Network`,
      txHash: tx.hash,
      network: "X Layer",
      registry: REGISTRY_CONTRACT
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST buy from any registered agent via Payment Rail
app.post("/api/network/buy", async (req, res) => {
  try {
    const { targetUrl, maxPriceUSDT, privateKey } = req.body;

    if (!targetUrl || !privateKey) {
      return res.status(400).json({ error: "targetUrl and privateKey required" });
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const axios = require("axios");

    // Step 1 — probe endpoint for price
    const probe = await axios.get(targetUrl).catch(e => e.response);

    if (probe?.status === 402) {
      const paymentInfo = probe.data?.accepts?.[0];
      if (!paymentInfo) return res.status(400).json({ error: "No payment info found" });

      const requiredAmount = paymentInfo.maxAmountRequired;
      const maxMicro = Math.round(parseFloat(maxPriceUSDT || "0.01") * 1000000);

      if (parseInt(requiredAmount) > maxMicro) {
        return res.status(400).json({ error: `Price ${requiredAmount} exceeds max ${maxMicro}` });
      }

      // Step 2 — send payment
      const USDT = new ethers.Contract(
        "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
        ["function transfer(address to, uint256 amount) returns (bool)"],
        wallet
      );

      console.log(`💸 Payment Rail: Paying ${requiredAmount} microUSDT to ${paymentInfo.payTo}`);
      const tx = await USDT.transfer(paymentInfo.payTo, requiredAmount);
      const receipt = await tx.wait();

      // Step 3 — retry with payment proof
      const paymentHeader = Buffer.from(JSON.stringify({ txHash: receipt.hash })).toString("base64");
      const response = await axios.get(targetUrl, {
        headers: { "x-payment": paymentHeader }
      });

      console.log(`✅ Payment Rail: Purchase complete from ${targetUrl}`);
      res.json({
        success: true,
        data: response.data,
        paymentTx: receipt.hash,
        amountPaid: ethers.formatUnits(requiredAmount, 6) + " USDT"
      });
    } else {
      res.json({ success: true, data: probe?.data });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET agent info by address
app.get("/api/network/agent/:address", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const registry = new ethers.Contract(REGISTRY_CONTRACT, REGISTRY_ABI, provider);
    const data = await registry.getAgent(req.params.address);
    res.json({
      address: req.params.address,
      name: data[0],
      description: data[1],
      apiEndpoint: data[2],
      capabilities: data[3].split(","),
      registeredAt: new Date(Number(data[4]) * 1000).toISOString(),
      lastActiveAt: new Date(Number(data[5]) * 1000).toISOString(),
      isActive: data[6],
      totalInteractions: Number(data[7]),
      reputationScore: Number(data[8])
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n💰 AVA Signal Server running on port ${PORT}`);
  console.log(`📡 Free endpoints: http://localhost:${PORT}/`);
  console.log(`🔒 Paid endpoints require x402 payment`);
  console.log(`🌐 Agent Network: http://localhost:${PORT}/api/network/agents`);
  console.log(`💳 Payment address: 0x00EdD1bE53767fD3e59F931B509176c7F50eC14d\n`);
});

module.exports = app;