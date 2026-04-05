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
const XAUTH_CONTRACT = "0x68b9Ab523B6C7D4fb732C4a886E570400FFF8B50";

const REPUTATION_ABI = ["function getSignalPrice() public view returns (uint256)"];

const REGISTRY_ABI = [
  "function registerAgent(string name, string description, string apiEndpoint, string capabilities) external",
  "function getAgent(address wallet) external view returns (string, string, string, string, uint256, uint256, bool, uint256, uint256)",
  "function getAllAgents() external view returns (address[])",
  "function getActiveAgents() external view returns (address[])",
  "function recordInteraction(address targetAgent) external",
  "function updateReputation(address agent, uint256 score) external"
];

const XAUTH_ABI = [
  "function grantDelegation((address worker, string[] allowedActions, address targetContract, uint256 budgetAmount, uint256 durationSeconds, string priceSymbol, uint256 minPrice, uint256 maxPrice, string metadata) params) external returns (bytes32)",
  "function isActionAllowed(bytes32 tokenId, string calldata action, uint256 amount) external view returns (bool)",
  "function revokeAndReclaim(bytes32 tokenId) external",
  "function getDelegation(bytes32 tokenId) external view returns (address, address, address, uint256, uint256, uint256, bool, bool)",
  "function getWorkerDelegations(address worker) external view returns (bytes32[] memory)",
  "function totalDelegations() external view returns (uint256)"
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
const DECISION_CACHE_MS = 60 * 60 * 1000;

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
// CORE ENDPOINTS
// ============================================

app.get("/", (req, res) => {
  res.json({
    name: "AVA - Autonomous Value Agent",
    description: "The first autonomous trading agent on X Layer with open agent network and XAuth delegation",
    wallet: "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d",
    free: ["/", "/health", "/api/status", "/api/reputation", "/api/logs", "/api/network/agents", "/api/network/discover", "/api/xauth/delegations"],
    paid: ["/api/signal", "/api/analysis", "/api/report", "/api/network/buy"],
    xauth: "/api/xauth/delegations",
    network: "/api/network/agents"
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
// XAUTH ENDPOINTS
// ============================================

// GET all active delegations
app.get("/api/xauth/delegations", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, provider);
    const total = await xauth.totalDelegations();

    res.json({
      contract: XAUTH_CONTRACT,
      totalDelegations: total.toString(),
      description: "XAuth — The OAuth of the Agentic Web. Agents delegate limited power without sharing private keys.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET check if specific token is valid
app.get("/api/xauth/verify/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { action, amount } = req.query;
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, provider);

    const amountMicro = ethers.parseUnits(amount || "0.001", 6);
    const allowed = await xauth.isActionAllowed(tokenId, action || "buy_signal", amountMicro);

    res.json({
      tokenId,
      action: action || "buy_signal",
      amount: amount || "0.001",
      isAllowed: allowed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET delegations for any worker address
app.get("/api/xauth/worker/:address", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, provider);
    const tokens = await xauth.getWorkerDelegations(req.params.address);

    res.json({
      worker: req.params.address,
      totalTokens: tokens.length,
      tokens,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST grant delegation to any agent
app.post("/api/xauth/grant", async (req, res) => {
  try {
    const { worker, allowedActions, budgetUSDT, durationSeconds, privateKey, metadata } = req.body;

    if (!worker || !privateKey || !budgetUSDT) {
      return res.status(400).json({ error: "worker, privateKey and budgetUSDT required" });
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, wallet);

    const budget = ethers.parseUnits(budgetUSDT.toString(), 6);

    // Approve USDT for escrow
    const usdt = new ethers.Contract(
      "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
      ["function approve(address spender, uint256 amount) returns (bool)"],
      wallet
    );
    await (await usdt.approve(XAUTH_CONTRACT, budget)).wait();

    const params = {
      worker,
      allowedActions: allowedActions || ["buy_signal", "fetch_analysis"],
      targetContract: ethers.ZeroAddress,
      budgetAmount: budget,
      durationSeconds: durationSeconds || 3600,
      priceSymbol: "",
      minPrice: 0,
      maxPrice: 0,
      metadata: metadata || "XAuth delegation"
    };

    const tx = await xauth.grantDelegation(params);
    const receipt = await tx.wait();
    const tokenId = receipt.logs[0]?.topics?.[1];

    console.log(`🔑 XAuth: New delegation granted to ${worker}`);

    res.json({
      success: true,
      tokenId,
      worker,
      budgetUSDT,
      durationSeconds: durationSeconds || 3600,
      txHash: tx.hash,
      message: `Delegation granted — ${worker} can now act within the budget without sharing private keys`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AVA AGENT NETWORK + PAYMENT RAIL
// ============================================

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
      } catch (e) {}
    }
    console.log(`🌐 Network: ${agents.length} agents discovered`);
    res.json({ network: "AVA Agent Network", totalAgents: agents.length, agents, registry: REGISTRY_CONTRACT, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    res.json({ query: capability || "all", results: agents.length, agents, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    res.json({ success: true, message: `${name} registered on AVA Agent Network`, txHash: tx.hash, network: "X Layer", registry: REGISTRY_CONTRACT });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/network/buy", async (req, res) => {
  try {
    const { targetUrl, maxPriceUSDT, privateKey } = req.body;
    if (!targetUrl || !privateKey) {
      return res.status(400).json({ error: "targetUrl and privateKey required" });
    }
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const probe = await axios.get(targetUrl).catch(e => e.response);
    if (probe?.status === 402) {
      const paymentInfo = probe.data?.accepts?.[0];
      if (!paymentInfo) return res.status(400).json({ error: "No payment info found" });
      const requiredAmount = paymentInfo.maxAmountRequired;
      const maxMicro = Math.round(parseFloat(maxPriceUSDT || "0.01") * 1000000);
      if (parseInt(requiredAmount) > maxMicro) {
        return res.status(400).json({ error: `Price ${requiredAmount} exceeds max ${maxMicro}` });
      }
      const USDT = new ethers.Contract(
        "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
        ["function transfer(address to, uint256 amount) returns (bool)"],
        wallet
      );
      const tx = await USDT.transfer(paymentInfo.payTo, requiredAmount);
      const receipt = await tx.wait();
      const paymentHeader = Buffer.from(JSON.stringify({ txHash: receipt.hash })).toString("base64");
      const response = await axios.get(targetUrl, { headers: { "x-payment": paymentHeader } });
      console.log(`✅ Payment Rail: Purchase complete from ${targetUrl}`);
      res.json({ success: true, data: response.data, paymentTx: receipt.hash, amountPaid: ethers.formatUnits(requiredAmount, 6) + " USDT" });
    } else {
      res.json({ success: true, data: probe?.data });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
  console.log(`🔑 XAuth: http://localhost:${PORT}/api/xauth/delegations`);
  console.log(`💳 Payment address: 0x00EdD1bE53767fD3e59F931B509176c7F50eC14d\n`);
});

module.exports = app;