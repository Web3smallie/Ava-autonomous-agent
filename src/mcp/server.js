const express = require("express");
const { ethers } = require("ethers");
const { getMarketData } = require("../agent/market");
const { makeDecision } = require("../agent/brain");
require("dotenv").config();

const mcpApp = express();
mcpApp.use(express.json());

const REPUTATION_CONTRACT = "0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C";
const AVABRAIN_CONTRACT = "0x4480d1B373Fb27254F95504A68E170E13b05bCeA";

const REPUTATION_ABI = [
  "function getReputation() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
  "function getSignalPrice() public view returns (uint256)"
];

const AVABRAIN_ABI = [
  "function getBrainStats() external view returns (uint256, uint256, uint256, uint256, uint256)",
  "function getAccuracyRate() external view returns (uint256)"
];

// MCP Server Info
mcpApp.get("/mcp", (req, res) => {
  res.json({
    name: "AVA MCP Server",
    version: "1.0.0",
    description: "AVA - Autonomous Value Agent MCP interface. Any AI agent can access AVA's trading intelligence.",
    tools: [
      {
        name: "get_trading_signal",
        description: "Get AVA's current BUY/SELL/HOLD trading signal for ETH-USDT",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "get_market_analysis",
        description: "Get full ETH-USDT market analysis from AVA",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "get_reputation",
        description: "Get AVA's onchain reputation and trading track record",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "get_brain_stats",
        description: "Get AVA's onchain brain statistics and accuracy rate",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "get_wallet_status",
        description: "Get AVA's current wallet balance and status",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ]
  });
});

// MCP Tool Handler
mcpApp.post("/mcp/tools/call", async (req, res) => {
  const { name } = req.body;
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

    res.status(404).json({ error: "Tool not found" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = mcpApp;