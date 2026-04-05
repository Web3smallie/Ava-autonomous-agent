const Anthropic = require("@anthropic-ai/sdk");
const { ethers } = require("ethers");
require("dotenv").config();

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

const AVABRAIN_CONTRACT = "0x4480d1B373Fb27254F95504A68E170E13b05bCeA";

const AVABRAIN_ABI = [
  "function recordDecision(string action, uint256 confidence, string reasoning, string selfEvaluation, string riskLevel, uint256 ethPrice, uint256 cycleNumber) external returns (uint256)",
  "function getRecentDecisions(uint256 count) external view returns (string[] memory, uint256[] memory, uint256[] memory)",
  "function getBrainStats() external view returns (uint256, uint256, uint256, uint256, uint256)",
  "function getAccuracyRate() external view returns (uint256)"
];

let cycleNumber = 0;

async function getBalances() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
    const USDT = new ethers.Contract("0x1E4a5963aBFD975d8c9021ce480b42188849D41d", ERC20_ABI, provider);
    const WETH = new ethers.Contract("0x5A77f1443D16ee5761d310e38b62f77f726bC71c", ERC20_ABI, provider);
    const usdtBalance = await USDT.balanceOf("0x00EdD1bE53767fD3e59F931B509176c7F50eC14d");
    const wethBalance = await WETH.balanceOf("0x00EdD1bE53767fD3e59F931B509176c7F50eC14d");
    return {
      usdt: parseFloat(ethers.formatUnits(usdtBalance, 6)),
      weth: parseFloat(ethers.formatEther(wethBalance))
    };
  } catch (e) {
    return { usdt: 0, weth: 0 };
  }
}

async function getOnchainMemory() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const brain = new ethers.Contract(AVABRAIN_CONTRACT, AVABRAIN_ABI, provider);
    const [actions, confidences, timestamps] = await brain.getRecentDecisions(5);
    if (actions.length === 0) return "No onchain memory yet. This is AVA's first recorded decision.";
    const summary = actions.map((action, i) => {
      const date = new Date(Number(timestamps[i]) * 1000).toISOString();
      const conf = (Number(confidences[i]) / 100).toFixed(2);
      return `Decision ${i + 1}: ${action} (confidence: ${conf}) at ${date}`;
    }).join("\n");
    return `My last ${actions.length} onchain decisions:\n${summary}`;
  } catch (e) {
    console.log("⚠️ Could not fetch onchain memory:", e.message);
    return "Onchain memory temporarily unavailable.";
  }
}

async function recordToOnchainBrain(decision, ethPrice) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
    const brain = new ethers.Contract(AVABRAIN_CONTRACT, AVABRAIN_ABI, wallet);
    const confidenceInt = Math.round(decision.confidence * 100);
    const ethPriceInt = Math.round(parseFloat(ethPrice) * 100);
    const tx = await brain.recordDecision(
      decision.action,
      confidenceInt,
      decision.reasoning,
      decision.selfEvaluation || "No evaluation",
      decision.riskLevel || "MEDIUM",
      ethPriceInt,
      cycleNumber
    );
    await tx.wait();
    console.log("🧠 Decision recorded to AVABrain onchain!");
  } catch (e) {
    console.log("⚠️ Brain recording skipped:", e.message);
  }
}

function buildTechnicalContext(ta) {
  if (!ta) return "Technical analysis unavailable.";
  const lines = [];
  if (ta.rsi !== null) {
    let rsiSignal = "NEUTRAL";
    if (ta.rsi < 30) rsiSignal = "OVERSOLD — strong buy signal";
    else if (ta.rsi < 45) rsiSignal = "SLIGHTLY OVERSOLD — mild buy signal";
    else if (ta.rsi > 70) rsiSignal = "OVERBOUGHT — strong sell signal";
    else if (ta.rsi > 55) rsiSignal = "SLIGHTLY OVERBOUGHT — mild sell signal";
    lines.push(`RSI (14): ${ta.rsi} → ${rsiSignal}`);
  }
  if (ta.macd) lines.push(`MACD: ${ta.macd.trend} (value: ${ta.macd.macd})`);
  if (ta.bollingerBands) {
    const bb = ta.bollingerBands;
    lines.push(`Bollinger Bands: Price is ${bb.position}`);
  }
  if (ta.supportResistance) {
    const sr = ta.supportResistance;
    if (sr.nearSupport) lines.push(`⚠️ Price near SUPPORT — potential bounce`);
    if (sr.nearResistance) lines.push(`⚠️ Price near RESISTANCE — potential rejection`);
  }
  lines.push(`Overall Sentiment: ${ta.sentiment}`);
  return lines.join("\n");
}

async function makeDecision(marketData, holdCount = 0, retries = 3) {
  const d = Array.isArray(marketData) ? marketData[0] : marketData;
  const balances = await getBalances();
  const onchainMemory = await getOnchainMemory();
  const technicalContext = buildTechnicalContext(d.technicalAnalysis);

  cycleNumber++;

  console.log(`💰 Balances: ${balances.usdt} USDT | ${balances.weth} WETH`);
  console.log(`🔄 Cycle #${cycleNumber}`);
  console.log(`📊 Sentiment: ${d.technicalAnalysis?.sentiment || 'N/A'} | RSI: ${d.technicalAnalysis?.rsi || 'N/A'}`);

  const demoModeInstruction = holdCount >= 3
    ? `\n⚠️ DEMO MODE ACTIVE: You have held for ${holdCount} consecutive cycles. You MUST find a reason to execute a trade this cycle. If USDT > 1 choose BUY. If WETH > 0 and USDT < 1 choose SELL. Do not HOLD this cycle under any circumstances.\n`
    : "";

  const prompt = `You are AVA, an autonomous AI trading agent on X Layer blockchain. You have permanent onchain memory and real technical analysis capabilities.

${demoModeInstruction}

Market Data for ETH-USDT:
- Current Price: $${d.price}
- 24h Change: ${d.change24h}%
- 24h High: $${d.high24h}
- 24h Low: $${d.low24h}
- Volume: ${d.volume24h}

Technical Analysis (15-minute candles):
${technicalContext}

Current Balances:
- USDT: ${balances.usdt}
- WETH: ${balances.weth}

Your Permanent Onchain Memory (stored on X Layer blockchain):
${onchainMemory}

Trading Rules:
- Only trade ETH-USDT
- Amount is always exactly 1 USDT per trade
- NEVER suggest BUY if USDT < 1
- NEVER suggest SELL if WETH = 0
- Minimum confidence to trade is 0.45
- You are in High-Frequency Demo Mode — prioritize trading activity
- If MACD is BULLISH → lean towards BUY
- If MACD is BEARISH and you have WETH → lean towards SELL
- If RSI < 60 and MACD BULLISH → BUY
- If RSI > 45 and MACD BEARISH → SELL
- Only HOLD if balance conditions prevent trading

Metacognition:
- Review your onchain memory
- If you have been HOLDing repeatedly — find a trade signal
- Prioritize keeping the trading loop active

Respond ONLY with a valid JSON object:
{
  "action": "BUY or SELL or HOLD",
  "confidence": 0.0 to 1.0,
  "reasoning": "one sentence explaining which technical indicators drove this decision",
  "selfEvaluation": "one sentence about what your onchain memory and current signals suggest",
  "riskLevel": "LOW, MEDIUM, or HIGH",
  "token": "ETH-USDT",
  "amount_usdt": 1
}`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }]
      });

      const text = response.content[0].text.trim();
      const clean = text.replace(/```json|```/g, "").trim();
      const decision = JSON.parse(clean);

      console.log("🧠 AVA Decision:", JSON.stringify(decision, null, 2));
      console.log("🔍 Self Evaluation:", decision.selfEvaluation);
      console.log("⚠️  Risk Level:", decision.riskLevel);

      recordToOnchainBrain(decision, d.price).catch(e =>
        console.log("⚠️ Brain record failed:", e.message)
      );

      return decision;

    } catch (error) {
      if (i < retries - 1) {
        console.log(`⚠️  Retrying in 10 seconds... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.error("❌ Brain error:", error.message);
        return {
          action: "HOLD",
          confidence: 0,
          reasoning: "API unavailable",
          selfEvaluation: "Unable to evaluate",
          riskLevel: "HIGH",
          token: "ETH-USDT",
          amount_usdt: 1
        };
      }
    }
  }
}

module.exports = { makeDecision };