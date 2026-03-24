const axios = require("axios");
require("dotenv").config();

const BASE_URL = "https://okx.com/api/v5";

async function getMarketData(symbol = "OKB-USDT") {
  try {
    const response = await axios.get(`${BASE_URL}/market/ticker`, {
      params: { instId: symbol }
    });

    const data = response.data.data[0];
    
    const openPrice = parseFloat(data.open24h);
    const lastPrice = parseFloat(data.last);
    const change24h = ((lastPrice - openPrice) / openPrice) * 100;

    return {
      symbol,
      price: lastPrice,
      change24h: parseFloat(change24h.toFixed(2)),
      volume24h: parseFloat(data.vol24h),
      high24h: parseFloat(data.high24h),
      low24h: parseFloat(data.low24h),
      openPrice: openPrice,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Market data error:", error.message);
    return null;
  }
}

async function test() {
  console.log("Fetching market data...");
  const data = await getMarketData("OKB-USDT");
  console.log("Market Data:", JSON.stringify(data, null, 2));
}

test();

module.exports = { getMarketData };