const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const axios = require("axios");
const { exec } = require("child_process");
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
const SHADOWLEDGER_CONTRACT = "0xc7Dbf29bd9ADEfDD98344db756e35ECE8758C6C1";
const AVA_WALLET = "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d";
const NOVA_WALLET = "0x93fa3CF2841502e3B31f8A2F1817223Ea5E08213";
const AGENTIC_WALLET = "0x05bd8ea55df0542deb5288cf2ebf1116f3248a6d";
const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
const CRITICAL_GAS = ethers.parseEther("0.04");
const NOVA_CRITICAL_GAS = ethers.parseEther("0.005");

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

const SHADOWLEDGER_ABI = [
  "function totalIntents() external view returns (uint256)",
  "function getAgentIntents(address agent) external view returns (uint256[] memory)",
  "function intents(uint256) external view returns (address agent, bytes32 reasoningHash, string ipfsMetadata, string action, uint256 rsi, int256 macd, uint256 ethPrice, uint256 timestamp, uint256 accessPrice, bool outcomeRecorded, bool wasSuccessful)"
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

// Treasury stats
let totalRevenueSentToVault = 0;
let totalRescuesExecuted = 0;

app.updateState = (decision, trade) => {};

// ============================================
// HELPER: Run OnchainOS skill command via TEE
// ============================================
function runSkillCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`🔐 Agentic Wallet TEE: Executing — ${command}`);
    exec(`npx skills run "${command}"`, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        console.log(`⚠️ TEE Command failed: ${error.message}`);
        resolve({ success: false, error: error.message, stdout, stderr });
      } else {
        console.log(`✅ TEE Command success: ${stdout}`);
        resolve({ success: true, stdout, stderr });
      }
    });
  });
}

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

async function getOKBPrice() {
  try {
    const response = await axios.get("https://okx.com/api/v5/market/ticker?instId=OKB-USDT");
    return parseFloat(response.data.data[0].last);
  } catch (e) {
    return 83;
  }
}

// ============================================
// TASK 2: SHGR HEARTBEAT — Monitors NOVA gas
// every 5 minutes and triggers TEE rescue
// ============================================
async function shgrHeartbeat() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const novaGas = await provider.getBalance(NOVA_WALLET);
    const novaGasFormatted = parseFloat(ethers.formatEther(novaGas)).toFixed(4);

    console.log(`💓 SHGR Heartbeat: NOVA gas = ${novaGasFormatted} OKB`);

    if (novaGas < ethers.parseEther("0.005")) {
      console.log(`🚨 SHGR: NOVA gas critical (${novaGasFormatted} OKB)! Initiating TEE rescue...`);
      console.log(`Action authorized by AVA; Signed by TEE Agentic Wallet`);

      // Step 1: Swap USDT for OKB via Agentic Wallet TEE
      const swapResult = await runSkillCommand(
        `Swap 0.05 USDT for OKB in my Agentic Wallet on X Layer`
      );

      if (swapResult.success) {
        console.log(`✅ SHGR: TEE swap complete — USDT → OKB`);

        // Step 2: Send OKB rescue to NOVA via Agentic Wallet TEE
        const sendResult = await runSkillCommand(
          `Send 0.01 OKB to ${NOVA_WALLET} on X Layer`
        );

        if (sendResult.success) {
          totalRescuesExecuted++;
          console.log(`✅ SHGR: 0.01 OKB sent to NOVA from Agentic Wallet TEE!`);
          console.log(`💚 SHGR: AVA-NOVA Symbiosis maintained — Action authorized by AVA; Signed by TEE Agentic Wallet`);
        } else {
          console.log(`⚠️ Treasury depleted. Awaiting x402 revenue.`);
        }
      } else {
        console.log(`⚠️ Treasury depleted. Awaiting x402 revenue.`);
      }
    }
  } catch (e) {
    console.log("⚠️ SHGR Heartbeat error:", e.message);
  }
}

// Start SHGR heartbeat every 5 minutes
setInterval(shgrHeartbeat, 5 * 60 * 1000);

// ============================================
// TASK 1: x402 REVENUE GATE + VAULT SWEEP
// After payment verified → sweep to Agentic Wallet
// ============================================
async function sweepRevenueToVault(amount, txHash) {
  try {
    console.log(`💰 Revenue Gate: Sweeping ${amount} USDT to Agentic Wallet Vault...`);
    console.log(`Action authorized by AVA; Signed by TEE Agentic Wallet`);

    const result = await runSkillCommand(
      `Transfer ${amount} USDT to ${AGENTIC_WALLET} on X Layer`
    );

    if (result.success) {
      totalRevenueSentToVault += parseFloat(amount);
      console.log(`✅ Revenue Gate: ${amount} USDT swept to Agentic Wallet Vault!`);
      console.log(`🏦 Total revenue in vault: ${totalRevenueSentToVault.toFixed(6)} USDT`);
    } else {
      console.log(`⚠️ Revenue sweep failed — will retry next cycle`);
    }
  } catch (e) {
    console.log("⚠️ Revenue sweep error:", e.message);
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
        payTo: AVA_WALLET,
        maxTimeoutSeconds: 300,
        asset: USDT_ADDRESS,
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

    // TASK 1: Sweep revenue to Agentic Wallet Vault after payment verified
    const signalPrice = await getDynamicPrice();
    const usdtAmount = ethers.formatUnits(signalPrice, 6);
    sweepRevenueToVault(usdtAmount, txHash).catch(e =>
      console.log("⚠️ Vault sweep skipped:", e.message)
    );

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
    description: "The first autonomous trading agent on X Layer with open agent network, XAuth delegation, AVA-NOVA Symbiosis SHGR and TEE Agentic Wallet Treasury",
    wallet: AVA_WALLET,
    agenticWallet: AGENTIC_WALLET,
    free: ["/", "/health", "/api/status", "/api/reputation", "/api/logs", "/api/network/agents", "/api/network/discover", "/api/xauth/delegations", "/api/gas-status", "/api/shadow/stats", "/api/shadow/intents", "/api/shadow/intent/:id", "/api/treasury"],
    paid: ["/api/signal", "/api/analysis", "/api/report", "/api/network/buy"],
    xauth: "/api/xauth/delegations",
    network: "/api/network/agents",
    shgr: "/api/gas-status",
    treasury: "/api/treasury"
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
    const USDT = new ethers.Contract(USDT_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);
    const balance = await USDT.balanceOf(AVA_WALLET);
    const usdt = parseFloat(ethers.formatUnits(balance, 6)).toFixed(2);
    const avaGas = await provider.getBalance(AVA_WALLET);
    const decision = await getCachedDecision();
    res.json({
      status: "ACTIVE",
      wallet: AVA_WALLET,
      agenticWallet: AGENTIC_WALLET,
      network: "X Layer",
      balance: { usdt },
      gas: {
        okb: ethers.formatEther(avaGas),
        needsRescue: avaGas < CRITICAL_GAS
      },
      lastDecision: decision,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ status: "ACTIVE", wallet: AVA_WALLET, network: "X Layer", timestamp: new Date().toISOString() });
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
// TASK 3: TREASURY TELEMETRY ENDPOINT
// ============================================
app.get("/api/treasury", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const USDT = new ethers.Contract(USDT_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);
    const [agenticBalance, agenticGas, okbPrice] = await Promise.all([
      USDT.balanceOf(AGENTIC_WALLET),
      provider.getBalance(AGENTIC_WALLET),
      getOKBPrice()
    ]);

    res.json({
      treasury: "AVA Agentic Wallet — TEE Secured Vault",
      address: AGENTIC_WALLET,
      explorer: `https://explorer.xlayer.tech/address/${AGENTIC_WALLET}`,
      balance: {
        usdt: ethers.formatUnits(agenticBalance, 6) + " USDT",
        okb: ethers.formatEther(agenticGas) + " OKB",
        usdValue: `$${(parseFloat(ethers.formatEther(agenticGas)) * okbPrice).toFixed(2)}`
      },
      stats: {
        totalRevenueSentToVault: totalRevenueSentToVault.toFixed(6) + " USDT",
        totalRescuesExecuted,
        mechanism: "All x402 signal revenue is swept to TEE Agentic Wallet after verification. SHGR uses Agentic Wallet to swap USDT for OKB and rescue NOVA when gas is critical."
      },
      authorization: "Action authorized by AVA; Signed by TEE Agentic Wallet",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SHGR — SELF HEALING GAS RELAYER
// ============================================

app.post("/api/gas-rescue", async (req, res) => {
  try {
    const { requester, amount } = req.body;
    if (!requester || !amount) {
      return res.status(400).json({ error: "requester and amount required" });
    }
    const okbPrice = await getOKBPrice();
    const rescueAmountOKB = parseFloat(amount);
    const repaymentUSDT = (rescueAmountOKB * okbPrice).toFixed(6);
    console.log(`🚨 SHGR: Gas rescue requested by ${requester}`);
    console.log(`💱 Required repayment: ${repaymentUSDT} USDT for ${amount} OKB`);
    return res.status(402).json({
      error: "Payment Required",
      message: "Gas rescue requires USDT repayment first",
      rescue: {
        okbAmount: amount,
        repaymentUSDT,
        payTo: AVA_WALLET,
        asset: USDT_ADDRESS,
        network: "xlayer"
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gas-rescue/confirm", async (req, res) => {
  try {
    const { requester, rescueAmount, paymentProof } = req.body;
    if (!requester || !rescueAmount || !paymentProof) {
      return res.status(400).json({ error: "requester, rescueAmount and paymentProof required" });
    }
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const paymentData = JSON.parse(Buffer.from(paymentProof, "base64").toString());
    const receipt = await provider.getTransactionReceipt(paymentData.txHash);
    if (!receipt || receipt.status !== 1) {
      return res.status(402).json({ error: "Repayment not confirmed onchain" });
    }
    console.log(`✅ SHGR: Repayment verified from ${requester}: ${paymentData.txHash}`);

    // Use Agentic Wallet TEE to send OKB rescue
    console.log(`🩹 SHGR: Instructing Agentic Wallet TEE to send ${rescueAmount} OKB rescue...`);
    console.log(`Action authorized by AVA; Signed by TEE Agentic Wallet`);

    const result = await runSkillCommand(
      `Send ${rescueAmount} OKB to ${requester} on X Layer`
    );

    if (result.success) {
      totalRescuesExecuted++;
      console.log(`✅ SHGR: OKB sent to ${requester} from TEE Agentic Wallet!`);
      console.log(`💚 SHGR: AVA-NOVA Symbiosis — agents keeping each other alive!`);
      res.json({
        success: true,
        rescueAmount,
        recipient: requester,
        authorization: "Action authorized by AVA; Signed by TEE Agentic Wallet",
        message: "Gas rescue complete — symbiosis maintained"
      });
    } else {
      console.log(`⚠️ Treasury depleted. Awaiting x402 revenue.`);
      res.status(500).json({ error: "Treasury depleted. Awaiting x402 revenue." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/gas-status", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const [avaGas, novaGas, agenticGas, okbPrice] = await Promise.all([
      provider.getBalance(AVA_WALLET),
      provider.getBalance(NOVA_WALLET),
      provider.getBalance(AGENTIC_WALLET),
      getOKBPrice()
    ]);
    res.json({
      symbiosis: "AVA-NOVA Symmetric Self-Healing Gas Relayer",
      okbPrice: `$${okbPrice}`,
      ava: {
        address: AVA_WALLET,
        okb: ethers.formatEther(avaGas),
        usdValue: `$${(parseFloat(ethers.formatEther(avaGas)) * okbPrice).toFixed(2)}`,
        status: avaGas < CRITICAL_GAS ? "⚠️ CRITICAL — rescue needed" : "✅ HEALTHY"
      },
      nova: {
        address: NOVA_WALLET,
        okb: ethers.formatEther(novaGas),
        usdValue: `$${(parseFloat(ethers.formatEther(novaGas)) * okbPrice).toFixed(2)}`,
        status: novaGas < ethers.parseEther("0.005") ? "⚠️ CRITICAL — rescue needed" : "✅ HEALTHY"
      },
      agenticWallet: {
        address: AGENTIC_WALLET,
        okb: ethers.formatEther(agenticGas),
        usdValue: `$${(parseFloat(ethers.formatEther(agenticGas)) * okbPrice).toFixed(2)}`,
        role: "TEE Treasury — signs all rescue transactions",
        status: "✅ ACTIVE"
      },
      threshold: "0.04 OKB (AVA) / 0.005 OKB (NOVA)",
      rescueAmount: "0.01 OKB",
      mechanism: "Agent detects low gas → requests rescue via x402 → Agentic Wallet TEE swaps USDT for OKB → sends rescue → agent repays in USDT",
      totalRescuesExecuted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// XAUTH ENDPOINTS
// ============================================

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
    const usdt = new ethers.Contract(USDT_ADDRESS, ["function approve(address spender, uint256 amount) returns (bool)"], wallet);
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
// SHADOWLEDGER ENDPOINTS
// ============================================

app.get("/api/shadow/stats", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const sl = new ethers.Contract(SHADOWLEDGER_CONTRACT, SHADOWLEDGER_ABI, provider);
    const total = await sl.totalIntents();
    const agentIntents = await sl.getAgentIntents(AVA_WALLET);
    res.json({
      contract: SHADOWLEDGER_CONTRACT,
      totalIntents: total.toString(),
      avaIntents: agentIntents.length,
      description: "ShadowLedger — AVA's onchain proof of intent before every trade",
      explorer: `https://explorer.xlayer.tech/address/${SHADOWLEDGER_CONTRACT}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/shadow/intent/:id", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const sl = new ethers.Contract(SHADOWLEDGER_CONTRACT, SHADOWLEDGER_ABI, provider);
    const id = parseInt(req.params.id);
    const intent = await sl.intents(id);
    res.json({
      intentId: id,
      agent: intent.agent,
      action: intent.action,
      reasoning: intent.ipfsMetadata,
      rsi: (Number(intent.rsi) / 100).toFixed(2),
      macd: (Number(intent.macd) / 100).toFixed(4),
      ethPrice: "$" + (Number(intent.ethPrice) / 100).toFixed(2),
      recordedAt: new Date(Number(intent.timestamp) * 1000).toISOString(),
      accessPrice: ethers.formatUnits(intent.accessPrice, 6) + " USDT",
      outcomeRecorded: intent.outcomeRecorded,
      wasSuccessful: intent.wasSuccessful,
      reasoningHash: intent.reasoningHash,
      explorer: `https://explorer.xlayer.tech/address/${SHADOWLEDGER_CONTRACT}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/shadow/intents", async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const sl = new ethers.Contract(SHADOWLEDGER_CONTRACT, SHADOWLEDGER_ABI, provider);
    const intentIds = await sl.getAgentIntents(AVA_WALLET);
    const intents = [];
    for (const id of intentIds.slice(-10)) {
      try {
        const intent = await sl.intents(id);
        intents.push({
          intentId: Number(id),
          action: intent.action,
          reasoning: intent.ipfsMetadata,
          rsi: (Number(intent.rsi) / 100).toFixed(2),
          macd: (Number(intent.macd) / 100).toFixed(4),
          ethPrice: "$" + (Number(intent.ethPrice) / 100).toFixed(2),
          recordedAt: new Date(Number(intent.timestamp) * 1000).toISOString(),
          wasSuccessful: intent.wasSuccessful,
          outcomeRecorded: intent.outcomeRecorded
        });
      } catch (e) {}
    }
    res.json({
      agent: AVA_WALLET,
      totalIntents: intentIds.length,
      recentIntents: intents,
      contract: SHADOWLEDGER_CONTRACT,
      timestamp: new Date().toISOString()
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
      const USDT = new ethers.Contract(USDT_ADDRESS, ["function transfer(address to, uint256 amount) returns (bool)"], wallet);
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
  console.log(`⛽ SHGR: http://localhost:${PORT}/api/gas-status`);
  console.log(`🏦 Treasury: http://localhost:${PORT}/api/treasury`);
  console.log(`💳 Payment address: ${AVA_WALLET}`);
  console.log(`🔐 Agentic Wallet (TEE Vault): ${AGENTIC_WALLET}\n`);
});

module.exports = app;