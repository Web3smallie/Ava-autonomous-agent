const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

async function makeDecision(marketData, retries = 3) {
  const d = Array.isArray(marketData) ? marketData[0] : marketData;

  const prompt = `You are AVA, an autonomous trading agent on X Layer blockchain. Analyze this market data and make ONE trading decision.

Market Data for ETH-USDT:
- Price: $${d.price}
- 24h Change: ${d.change24h}%
- 24h High: $${d.high24h}
- 24h Low: $${d.low24h}
- Volume: ${d.volume24h}

Rules:
- Only trade ETH-USDT
- Amount is always exactly 1 USDT per trade
- BUY when price shows upward momentum
- SELL when price is dropping to recover USDT
- HOLD when market is unclear
- Minimum confidence to trade is 0.65

Respond ONLY with a valid JSON object:
{
  "action": "BUY or SELL or HOLD",
  "confidence": 0.0 to 1.0,
  "reasoning": "one sentence explanation",
  "token": "ETH-USDT",
  "amount_usdt": 1
}`;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }]
      });

      const text = response.content[0].text.trim();
      const clean = text.replace(/```json|```/g, "").trim();
      const decision = JSON.parse(clean);

      console.log("🧠 AVA Decision:", JSON.stringify(decision, null, 2));
      return decision;

    } catch (error) {
      if (i < retries - 1) {
        console.log(`⚠️  Retrying in 10 seconds... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.error("❌ Brain error:", error.message);
        return { action: "HOLD", confidence: 0, reasoning: "API unavailable", token: "ETH-USDT", amount_usdt: 1 };
      }
    }
  }
}

module.exports = { makeDecision };