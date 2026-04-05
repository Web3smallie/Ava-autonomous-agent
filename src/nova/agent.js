const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
const AVA_API = "https://ava-autonomous-agent-production.up.railway.app";
const AVA_WALLET = "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d";
const XAUTH_CONTRACT = "0x68b9Ab523B6C7D4fb732C4a886E570400FFF8B50";
const PAYMENT_AMOUNT = "0.001";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];

const XAUTH_ABI = [
  "function executeAction(bytes32 tokenId, string calldata action, uint256 amount, address payTo) external returns (bool)",
  "function isActionAllowed(bytes32 tokenId, string calldata action, uint256 amount) external view returns (bool)",
  "function getWorkerDelegations(address worker) external view returns (bytes32[] memory)"
];

let activeDelegationToken = null;

async function getActiveDelegationToken(novaWallet) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, provider);
    const tokens = await xauth.getWorkerDelegations(novaWallet.address);
    if (tokens.length === 0) {
      console.log("⚠️ XAuth: No delegation tokens found for NOVA");
      return null;
    }
    const latestToken = tokens[tokens.length - 1];
    const amount = ethers.parseUnits(PAYMENT_AMOUNT, 6);
    const allowed = await xauth.isActionAllowed(latestToken, "buy_signal", amount);
    if (allowed) {
      console.log(`✅ XAuth: Valid delegation token found`);
      return latestToken;
    }
    console.log("⚠️ XAuth: Delegation token expired or budget exhausted");
    return null;
  } catch (e) {
    console.log("⚠️ XAuth check skipped:", e.message);
    return null;
  }
}

async function payForSignal() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const novaWallet = new ethers.Wallet(process.env.NOVA_PRIVATE_KEY, provider);

  console.log("🤖 NOVA requesting signal from AVA...");

  // Check for active XAuth delegation token
  const tokenId = await getActiveDelegationToken(novaWallet);
  if (tokenId) {
    console.log(`🎫 XAuth: Using delegation token ${tokenId}`);
    console.log("🔐 XAuth: NOVA authorized without sharing private key");
  }

  // Step 1: Hit AVA endpoint - expect 402
  try {
    await axios.get(AVA_API + "/api/signal");
  } catch (error) {
    if (error.response && error.response.status === 402) {
      console.log("📋 AVA requires payment - processing...");
    } else {
      throw new Error("AVA server not responding");
    }
  }

  // Step 2: If delegation token exists use XAuth executeAction
  if (tokenId) {
    try {
      const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, novaWallet);
      const amount = ethers.parseUnits(PAYMENT_AMOUNT, 6);
      console.log("💸 NOVA executing payment via XAuth delegation...");
      const tx = await xauth.executeAction(tokenId, "buy_signal", amount, AVA_WALLET);
      await tx.wait();
      console.log("✅ XAuth: Payment executed via delegation!");
      console.log("🔗 XAuth TX:", tx.hash);

      // Get signal with XAuth proof
      const paymentProof = Buffer.from(JSON.stringify({
        txHash: tx.hash,
        xauthToken: tokenId,
        action: "buy_signal",
        amount: PAYMENT_AMOUNT,
        network: "xlayer",
        from: novaWallet.address,
        to: AVA_WALLET
      })).toString("base64");

      const response = await axios.get(AVA_API + "/api/signal", {
        headers: { "x-payment": paymentProof }
      });

      console.log("\n🎉 AVA served signal to NOVA via XAuth!");
      console.log("📊 Signal:", JSON.stringify(response.data, null, 2));
      return response.data;

    } catch (e) {
      console.log("⚠️ XAuth payment failed, falling back to direct payment:", e.message);
    }
  }

  // Step 3: Fallback — direct x402 payment
  console.log("💸 NOVA paying AVA $" + PAYMENT_AMOUNT + " USDT directly...");
  const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, novaWallet);
  const paymentTx = await usdt.transfer(AVA_WALLET, ethers.parseUnits(PAYMENT_AMOUNT, 6));
  await paymentTx.wait();

  console.log("✅ Payment confirmed on X Layer!");
  console.log("🔗 Payment TX:", paymentTx.hash);
  console.log("🌐 View: https://explorer.xlayer.tech/tx/" + paymentTx.hash);

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
    headers: { "x-payment": paymentProof }
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
  console.log("NOVA pays AVA for trading signals via x402 + XAuth");
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

startNova().catch(function(err) {
  console.error("NOVA failed:", err.message);
});