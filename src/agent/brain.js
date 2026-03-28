const Anthropic = require("@anthropic-ai/sdk");
const { ethers } = require("ethers");
require("dotenv").config();

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

// Store recent decisions in memory for self-evaluation
const recentDecisions = [];

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

function getSelfEvaluationContext() {
  if (recentDecisions.length === 0) {
    return "This is my first decision. No prior history to evaluate.";
  }
  const summary = recentDecisions.slice(-5).map((d, i) =>
    `Decision ${i + 1}: ${d.action} (confidence: ${d.confidence}) — ${d.reasoning}`
  ).join("\n");
  return `My last ${recentDecisions.slice(-5).length} decisions:\n${summary}`;
}

async function makeDecision(marketData, retries = 3) {
  const d = Array.isArray(marketData) ? marketData[0] : marketData;
  const balances = await getBalances();
  const selfContext = getSelfEvaluationContext();

  console.log(`💰 Balances: ${balances.usdt} USDT | ${balances.weth} WETH`);

  const prompt = `You are AVA, an autonomous trading agent on X Layer blockchain. You have metacognitive awareness — you evaluate your own past decisions and improve your strategy over time.

Market Data for ETH-USDT:
- Price: $${d.price}
- 24h Change: ${d.change24h}%
- 24h High: $${d.high24h}
- 24h Low: $${d.low24h}
- Volume: ${d.volume24h}

Current Balances:
- USDT: ${balances.usdt}
- WETH: ${balances.weth}

Your Recent Decision History (for self-evaluation):
${selfContext}

Trading Rules:
- Only trade ETH-USDT
- Amount is always exactly 1 USDT per trade
- If you have USDT >= 1 and market looks good → BUY
- If you have WETH > 0 and price has risen or market is bearish → SELL
- If you have no USDT and no WETH → HOLD
- If you have USDT >= 1 and price is very low (good entry) → BUY even if trend is down
- If you have WETH and price drops significantly → SELL to recover USDT
- NEVER suggest BUY if USDT < 1
- NEVER suggest SELL if WETH = 0
- Minimum confidence to trade is 0.65

Risk Assessment:
- If 24h change > 5% drop → HIGH RISK, reduce confidence by 0.15
- If 24h change > 3% drop → MEDIUM RISK, reduce confidence by 0.10
- If market is highly volatile → increase caution

Metacognition:
- Review your recent decisions above
- If you have been making the same decision repeatedly, question if it is still valid
- Adjust your confidence based on your recent performance
- Be honest about uncertainty

Respond ONLY with a valid JSON object:
{
  "action": "BUY or SELL or HOLD",
  "confidence": 0.0 to 1.0,
  "reasoning": "one sentence explanation",
  "selfEvaluation": "one sentence about what you learned from recent decisions",
  "riskLevel": "LOW, MEDIUM, or HIGH",
  "token": "ETH-USDT",
  "amount_usdt": 1
}`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }]
      });

      const text = response.content[0].text.trim();
      const clean = text.replace(/```json|```/g, "").trim();
      const decision = JSON.parse(clean);

      // Store decision for future self-evaluation
      recentDecisions.push({
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        timestamp: new Date().toISOString()
      });

      // Keep only last 10 decisions
      if (recentDecisions.length > 10) recentDecisions.shift();

      console.log("🧠 AVA Decision:", JSON.stringify(decision, null, 2));
      console.log("🔍 Self Evaluation:", decision.selfEvaluation);
      console.log("⚠️  Risk Level:", decision.riskLevel);
      return decision;

    } catch (error) {
      if (i < retries - 1) {
        console.log(`⚠️  Retrying in 10 seconds... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.error("❌ Brain error:", error.message);
        return { action: "HOLD", confidence: 0, reasoning: "API unavailable", selfEvaluation: "Unable to evaluate", riskLevel: "HIGH", token: "ETH-USDT", amount_usdt: 1 };
      }
    }
  }
}

module.exports = { makeDecision };