const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
const AVA_API = "http://localhost:3000";
const AVA_WALLET = "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d";
const PAYMENT_AMOUNT = "0.001";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];

async function payForSignal() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const novaWallet = new ethers.Wallet(process.env.NOVA_PRIVATE_KEY, provider);

  console.log("🤖 NOVA requesting signal from AVA...");

  // Step 1: Hit AVA endpoint - expect 402
  try {
    await axios.get(AVA_API + "/api/signal");
  } catch (error) {
    if (error.response && error.response.status === 402) {
      console.log("📋 AVA requires payment - processing...");
    } else {
      throw new Error("AVA server not responding - is it running?");
    }
  }

  // Step 2: Pay AVA on X Layer
  console.log("💸 NOVA paying AVA $" + PAYMENT_AMOUNT + " USDT on X Layer...");
  const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, novaWallet);

  const paymentTx = await usdt.transfer(
    AVA_WALLET,
    ethers.parseUnits(PAYMENT_AMOUNT, 6)
  );
  await paymentTx.wait();

  console.log("✅ Payment confirmed on X Layer!");
  console.log("🔗 Payment TX:", paymentTx.hash);
  console.log("🌐 View: https://explorer.xlayer.tech/tx/" + paymentTx.hash);

  // Step 3: Send payment proof to AVA
  const paymentProof = Buffer.from(JSON.stringify({
    txHash: paymentTx.hash,
    amount: PAYMENT_AMOUNT,
    asset: USDT_ADDRESS,
    network: "xlayer",
    from: novaWallet.address,
    to: AVA_WALLET
  })).toString("base64");

  console.log("📡 Sending payment proof to AVA...");
  const response = await axios.get(AVA_API + "/api/signal", {
    headers: {
      "x-payment": paymentProof
    }
  });

  console.log("\n🎉 AVA served signal to NOVA!");
  console.log("📊 Signal:", JSON.stringify(response.data, null, 2));

  return response.data;
}

async function runCycle(cycleCount) {
  console.log("\n🔄 NOVA Cycle #" + cycleCount + " - " + new Date().toISOString());
  console.log("─────────────────────────────────────");

  try {
    const signal = await payForSignal();
    console.log("\n💡 NOVA received signal: " + signal.signal + " with " + (signal.confidence * 100) + "% confidence");
    console.log("📝 Reasoning: " + signal.reasoning);
  } catch (error) {
    console.error("❌ NOVA cycle error:", error.message);
  }
}

async function startNova() {
  console.log("🤖 NOVA - Network Oracle Value Agent");
  console.log("=====================================");
  console.log("NOVA pays AVA for trading signals via x402");
  console.log("Cycle interval: 10 minutes");
  console.log("Press Ctrl+C to stop\n");

  let cycleCount = 0;

  cycleCount++;
  await runCycle(cycleCount);

  setInterval(async function() {
    cycleCount++;
    await runCycle(cycleCount);
  }, 10 * 60 * 1000);

  process.on("SIGINT", function() {
    console.log("\n👋 NOVA shutting down...");
    process.exit(0);
  });
}

startNova().then(function() {}).catch(function(err) {
  console.error("NOVA failed:", err.message);
});