const axios = require("axios");
const { ethers } = require("ethers");
require("dotenv").config();

const BASE_URL = "https://okx.com/api/v5";

const PRICE_ORACLE_CONTRACT = "0xbC93e68B12903A56Cd340fa34ad80Ee64E90018e";
const PRICE_ORACLE_ABI = [
  "function updatePrice(string calldata symbol, uint256 price) external",
  "function getPrice(string calldata symbol) external view returns (uint256)"
];

async function updateOraclePrice(symbol, price) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
    const oracle = new ethers.Contract(PRICE_ORACLE_CONTRACT, PRICE_ORACLE_ABI, wallet);
    const priceInt = Math.round(price * 100);
    const tx = await oracle.updatePrice(symbol, priceInt, {
  gasPrice: ethers.parseUnits("0.1", "gwei")
});
    await tx.wait();
    console.log(`🔮 Oracle updated: ${symbol} = $${price}`);
  } catch (e) {
    console.log("⚠️ Oracle update skipped:", e.message);
  }
}

async function getCandles(symbol, bar = "15m", limit = 50) {
  try {
    const response = await axios.get(`${BASE_URL}/market/candles`, {
      params: { instId: symbol, bar, limit }
    });
    return response.data.data.map(c => ({
      timestamp: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    })).reverse();
  } catch (e) {
    console.log("⚠️ Candles error:", e.message);
    return [];
  }
}

function calculateRSI(candles, period = 14) {
  try {
    if (candles.length < period + 1) return null;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < candles.length; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
  } catch (e) {
    return null;
  }
}

function calculateEMA(candles, period) {
  try {
    if (candles.length < period) return null;
    const k = 2 / (period + 1);
    let ema = candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;
    for (let i = period; i < candles.length; i++) {
      ema = candles[i].close * k + ema * (1 - k);
    }
    return parseFloat(ema.toFixed(2));
  } catch (e) {
    return null;
  }
}

function calculateMACD(candles) {
  try {
    if (candles.length < 26) return null;
    const ema12 = calculateEMA(candles, 12);
    const ema26 = calculateEMA(candles, 26);
    if (!ema12 || !ema26) return null;
    const macdLine = parseFloat((ema12 - ema26).toFixed(4));
    return {
      macd: macdLine,
      signal: ema12,
      histogram: macdLine,
      trend: macdLine > 0 ? "BULLISH" : "BEARISH"
    };
  } catch (e) {
    return null;
  }
}

function calculateBollingerBands(candles, period = 20) {
  try {
    if (candles.length < period) return null;
    const recent = candles.slice(-period);
    const sma = recent.reduce((sum, c) => sum + c.close, 0) / period;
    const variance = recent.reduce((sum, c) => sum + Math.pow(c.close - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = parseFloat((sma + 2 * stdDev).toFixed(2));
    const lower = parseFloat((sma - 2 * stdDev).toFixed(2));
    const current = candles[candles.length - 1].close;
    let position = "MIDDLE";
    if (current > upper) position = "ABOVE_UPPER";
    else if (current < lower) position = "BELOW_LOWER";
    else if (current > sma) position = "UPPER_HALF";
    else position = "LOWER_HALF";
    return {
      upper,
      middle: parseFloat(sma.toFixed(2)),
      lower,
      position,
      squeeze: (upper - lower) < (sma * 0.02)
    };
  } catch (e) {
    return null;
  }
}

function calculateSupportResistance(candles) {
  try {
    if (candles.length < 10) return null;
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const resistance = parseFloat(Math.max(...highs).toFixed(2));
    const support = parseFloat(Math.min(...lows).toFixed(2));
    const current = candles[candles.length - 1].close;
    const distanceToResistance = parseFloat(((resistance - current) / current * 100).toFixed(2));
    const distanceToSupport = parseFloat(((current - support) / current * 100).toFixed(2));
    return {
      resistance,
      support,
      distanceToResistance: distanceToResistance + "%",
      distanceToSupport: distanceToSupport + "%",
      nearResistance: distanceToResistance < 1,
      nearSupport: distanceToSupport < 1
    };
  } catch (e) {
    return null;
  }
}

function getMarketSentiment(rsi, macd, bb) {
  let bullishSignals = 0;
  let bearishSignals = 0;
  if (rsi) {
    if (rsi < 30) bullishSignals += 2;
    else if (rsi < 45) bullishSignals += 1;
    else if (rsi > 70) bearishSignals += 2;
    else if (rsi > 55) bearishSignals += 1;
  }
  if (macd) {
    if (macd.trend === "BULLISH") bullishSignals += 1;
    else bearishSignals += 1;
  }
  if (bb) {
    if (bb.position === "BELOW_LOWER") bullishSignals += 2;
    else if (bb.position === "LOWER_HALF") bullishSignals += 1;
    else if (bb.position === "ABOVE_UPPER") bearishSignals += 2;
    else if (bb.position === "UPPER_HALF") bearishSignals += 1;
  }
  if (bullishSignals > bearishSignals + 1) return "BULLISH";
  if (bearishSignals > bullishSignals + 1) return "BEARISH";
  return "NEUTRAL";
}

async function getMarketData(symbol = "ETH-USDT") {
  try {
    const [tickerResponse, candles] = await Promise.all([
      axios.get(`${BASE_URL}/market/ticker`, { params: { instId: symbol } }),
      getCandles(symbol, "15m", 50)
    ]);

    const data = tickerResponse.data.data[0];
    const openPrice = parseFloat(data.open24h);
    const lastPrice = parseFloat(data.last);
    const change24h = ((lastPrice - openPrice) / openPrice) * 100;

    const rsi = calculateRSI(candles);
    const macd = calculateMACD(candles);
    const bollingerBands = calculateBollingerBands(candles);
    const supportResistance = calculateSupportResistance(candles);
    const sentiment = getMarketSentiment(rsi, macd, bollingerBands);

    console.log(`📊 Technical Analysis for ${symbol}:`);
    console.log(`   RSI: ${rsi} ${rsi < 30 ? '🟢 OVERSOLD' : rsi > 70 ? '🔴 OVERBOUGHT' : '⚪ NEUTRAL'}`);
    console.log(`   MACD: ${macd?.trend} (${macd?.macd})`);
    console.log(`   Bollinger: ${bollingerBands?.position}`);
    console.log(`   Sentiment: ${sentiment}`);

    // Update PriceOracle onchain — AVA IS the oracle
    setTimeout(() => {
  updateOraclePrice("ETH-USDT", lastPrice).catch(e =>
    console.log("⚠️ Oracle update failed:", e.message)
  );
}, 15000);

    return {
      symbol,
      price: lastPrice,
      change24h: parseFloat(change24h.toFixed(2)),
      volume24h: parseFloat(data.vol24h),
      high24h: parseFloat(data.high24h),
      low24h: parseFloat(data.low24h),
      openPrice,
      technicalAnalysis: {
        rsi,
        macd,
        bollingerBands,
        supportResistance,
        sentiment
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Market data error:", error.message);
    return null;
  }
}

module.exports = { getMarketData };