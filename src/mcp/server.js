const express = require("express");
const { ethers } = require("ethers");
const { getMarketData } = require("../agent/market");
const { makeDecision } = require("../agent/brain");
require("dotenv").config();

const mcpApp = express();
mcpApp.use(express.json());

const REPUTATION_CONTRACT = "0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C";
const AVABRAIN_CONTRACT = "0x4480d1B373Fb27254F95504A68E170E13b05bCeA";
const XAUTH_CONTRACT = "0x68b9Ab523B6C7D4fb732C4a886E570400FFF8B50";

const REPUTATION_ABI = [
  "function getReputation() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
  "function getSignalPrice() public view returns (uint256)"
];

const AVABRAIN_ABI = [
  "function getBrainStats() external view returns (uint256, uint256, uint256, uint256, uint256)",
  "function getAccuracyRate() external view returns (uint256)"
];

const XAUTH_ABI = [
  "function grantDelegation((address worker, string[] allowedActions, address targetContract, uint256 budgetAmount, uint256 durationSeconds, string priceSymbol, uint256 minPrice, uint256 maxPrice, string metadata) params) external returns (bytes32)",
  "function isActionAllowed(bytes32 tokenId, string calldata action, uint256 amount) external view returns (bool)",
  "function getWorkerDelegations(address worker) external view returns (bytes32[] memory)",
  "function totalDelegations() external view returns (uint256)"
];

mcpApp.get("/mcp", (req, res) => {
  res.json({
    name: "AVA MCP Server",
    version: "2.0.0",
    description: "AVA - Autonomous Value Agent MCP interface. Any AI agent can access AVA's trading intelligence and delegate permissions via XAuth.",
    tools: [
      {
        name: "get_trading_signal",
        description: "Get AVA's current BUY/SELL/HOLD trading signal with RSI, MACD and Bollinger Band analysis",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "get_market_analysis",
        description: "Get full ETH-USDT market analysis including technical indicators from AVA",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "get_reputation",
        description: "Get AVA's onchain reputation and trading track record",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "get_brain_stats",
        description: "Get AVA's onchain brain statistics and accuracy rate",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "get_wallet_status",
        description: "Get AVA's current wallet balance and status",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "grant_delegation",
        description: "Grant another agent limited spending power via XAuth without sharing private keys",
        inputSchema: {
          type: "object",
          properties: {
            worker: { type: "string", description: "Wallet address of the agent to delegate to" },
            allowedActions: { type: "array", items: { type: "string" }, description: "List of allowed actions" },
            budgetUSDT: { type: "string", description: "Budget in USDT to lock in escrow" },
            durationSeconds: { type: "number", description: "How long the delegation lasts in seconds" },
            privateKey: { type: "string", description: "Private key of the principal agent" }
          },
          required: ["worker", "budgetUSDT", "privateKey"]
        }
      },
      {
        name: "verify_delegation",
        description: "Verify if a delegation token is valid for a specific action and amount",
        inputSchema: {
          type: "object",
          properties: {
            tokenId: { type: "string", description: "The delegation token ID" },
            action: { type: "string", description: "The action to verify" },
            amount: { type: "string", description: "Amount in USDT" }
          },
          required: ["tokenId", "action"]
        }
      },
      {
        name: "get_delegations",
        description: "Get all delegation tokens for a specific agent address",
        inputSchema: {
          type: "object",
          properties: {
            address: { type: "string", description: "Agent wallet address" }
          },
          required: ["address"]
        }
      }
    ]
  });
});

mcpApp.post("/mcp/tools/call", async (req, res) => {
  const { name, input } = req.body;
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  try {
    if (name === "get_trading_signal") {
      const marketData = await getMarketData("ETH-USDT");
      const decision = await makeDecision(marketData);
      return res.json({
        content: [{
          type: "text",
          text: JSON.stringify({
            action: decision.action,
            confidence: decision.confidence,
            reasoning: decision.reasoning,
            selfEvaluation: decision.selfEvaluation,
            riskLevel: decision.riskLevel,
            technicalAnalysis: marketData?.technicalAnalysis,
            timestamp: new Date().toISOString()
          })
        }]
      });
    }

    if (name === "get_market_analysis") {
      const marketData = await getMarketData("ETH-USDT");
      const decision = await makeDecision(marketData);
      return res.json({
        content: [{
          type: "text",
          text: JSON.stringify({
            market: marketData,
            analysis: decision,
            timestamp: new Date().toISOString()
          })
        }]
      });
    }

    if (name === "get_reputation") {
      const reputation = new ethers.Contract(REPUTATION_CONTRACT, REPUTATION_ABI, provider);
      const data = await reputation.getReputation();
      const price = await reputation.getSignalPrice();
      return res.json({
        content: [{
          type: "text",
          text: JSON.stringify({
            totalTrades: data[0].toString(),
            successfulTrades: data[1].toString(),
            successRate: data[2].toString() + "%",
            signalPrice: ethers.formatUnits(price, 6) + " USDT",
            contract: REPUTATION_CONTRACT
          })
        }]
      });
    }

    if (name === "get_brain_stats") {
      const brain = new ethers.Contract(AVABRAIN_CONTRACT, AVABRAIN_ABI, provider);
      const stats = await brain.getBrainStats();
      const accuracy = await brain.getAccuracyRate();
      return res.json({
        content: [{
          type: "text",
          text: JSON.stringify({
            totalDecisions: stats[0].toString(),
            totalExecuted: stats[1].toString(),
            totalCorrect: stats[2].toString(),
            accuracyRate: accuracy.toString() + "%",
            contract: AVABRAIN_CONTRACT
          })
        }]
      });
    }

    if (name === "get_wallet_status") {
      const USDT = new ethers.Contract(
        "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
        ["function balanceOf(address) view returns (uint256)"],
        provider
      );
      const balance = await USDT.balanceOf("0x00EdD1bE53767fD3e59F931B509176c7F50eC14d");
      const usdt = parseFloat(ethers.formatUnits(balance, 6)).toFixed(2);
      return res.json({
        content: [{
          type: "text",
          text: JSON.stringify({
            wallet: "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d",
            network: "X Layer",
            balance: usdt + " USDT",
            status: "ACTIVE"
          })
        }]
      });
    }

    if (name === "grant_delegation") {
      const { worker, allowedActions, budgetUSDT, durationSeconds, privateKey, metadata } = input;
      if (!worker || !privateKey || !budgetUSDT) {
        return res.status(400).json({ error: "worker, privateKey and budgetUSDT required" });
      }

      const wallet = new ethers.Wallet(privateKey, provider);
      const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, wallet);
      const budget = ethers.parseUnits(budgetUSDT.toString(), 6);

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
        metadata: metadata || "XAuth MCP delegation"
      };

      const tx = await xauth.grantDelegation(params);
      const receipt = await tx.wait();
      const tokenId = receipt.logs[0]?.topics?.[1];

      return res.json({
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            tokenId,
            worker,
            budgetUSDT,
            durationSeconds: durationSeconds || 3600,
            txHash: tx.hash,
            message: "Delegation granted via XAuth — agent can now act within budget without sharing private keys"
          })
        }]
      });
    }

    if (name === "verify_delegation") {
      const { tokenId, action, amount } = input;
      const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, provider);
      const amountMicro = ethers.parseUnits(amount || "0.001", 6);
      const allowed = await xauth.isActionAllowed(tokenId, action, amountMicro);
      return res.json({
        content: [{
          type: "text",
          text: JSON.stringify({
            tokenId,
            action,
            amount: amount || "0.001",
            isAllowed: allowed,
            timestamp: new Date().toISOString()
          })
        }]
      });
    }

    if (name === "get_delegations") {
      const { address } = input;
      const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, provider);
      const tokens = await xauth.getWorkerDelegations(address);
      return res.json({
        content: [{
          type: "text",
          text: JSON.stringify({
            address,
            totalTokens: tokens.length,
            tokens,
            timestamp: new Date().toISOString()
          })
        }]
      });
    }

    res.status(404).json({ error: "Tool not found" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = mcpApp;