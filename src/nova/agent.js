const { ethers } = require("ethers");
const axios = require("axios");
require("dotenv").config();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
const AVA_API = "https://ava-autonomous-agent-production.up.railway.app";
const AVA_WALLET = "0x00EdD1bE53767fD3e59F931B509176c7F50eC14d";
const NOVA_WALLET = "0x93fa3CF2841502e3B31f8A2F1817223Ea5E08213";
const XAUTH_CONTRACT = "0x68b9Ab523B6C7D4fb732C4a886E570400FFF8B50";
const PAYMENT_AMOUNT = "0.001";

const CRITICAL_GAS_THRESHOLD = ethers.parseEther("0.04");
const RESCUE_AMOUNT = ethers.parseEther("0.01");

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];

const XAUTH_ABI = [
  "function executeAction(bytes32 tokenId, string calldata action, uint256 amount, address payTo) external returns (bool)",
  "function isActionAllowed(bytes32 tokenId, string calldata action, uint256 amount) external view returns (bool)",
  "event DelegationCreated(bytes32 indexed tokenId, address indexed principal, address indexed worker, uint256 budget)"
];

let currentTokenId = null;
let novaWallet = null;
let xauthContract = null;
let provider = null;

async function getOKBPrice() {
  try {
    const response = await axios.get("https://okx.com/api/v5/market/ticker?instId=OKB-USDT");
    return parseFloat(response.data.data[0].last);
  } catch (e) {
    console.log("⚠️ OKB price fetch failed:", e.message);
    return 83;
  }
}

async function checkAndRequestGasRescue() {
  try {
    const novaGas = await provider.getBalance(NOVA_WALLET);
    const novaGasFormatted = parseFloat(ethers.formatEther(novaGas)).toFixed(4);

    if (novaGas >= CRITICAL_GAS_THRESHOLD) {
      console.log(`⛽ NOVA Gas Check: ${novaGasFormatted} OKB — HEALTHY`);
      return;
    }

    console.log(`🚨 SHGR: NOVA OKB low (${novaGasFormatted})! Requesting rescue from AVA...`);

    // Step 1 — Hit AVA's gas rescue endpoint (expect 402)
    try {
      await axios.post(`${AVA_API}/api/gas-rescue`, {
        requester: NOVA_WALLET,
        amount: "0.01"
      });
    } catch (error) {
      if (error.response?.status === 402) {
        console.log("📋 SHGR: AVA requires repayment proof — preparing x402...");
      }
    }

    // Step 2 — Get OKB price for repayment calculation
    const okbPrice = await getOKBPrice();
    const repaymentUSDT = (0.01 * okbPrice).toFixed(6);
    console.log(`💱 OKB Price: $${okbPrice} | Repayment: ${repaymentUSDT} USDT`);

    // Step 3 — Send USDT repayment to AVA first (x402)
    console.log(`💸 SHGR: Sending ${repaymentUSDT} USDT to AVA as repayment...`);
    const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, novaWallet);
    const repaymentAmount = ethers.parseUnits(repaymentUSDT, 6);
    const repayTx = await usdt.transfer(AVA_WALLET, repaymentAmount);
    await repayTx.wait();
    console.log(`✅ SHGR: Repayment sent! TX: ${repayTx.hash}`);

    // Step 4 — Send payment proof to AVA to release OKB rescue
    const paymentProof = Buffer.from(JSON.stringify({
      txHash: repayTx.hash,
      amount: repaymentUSDT,
      asset: USDT_ADDRESS,
      network: "xlayer",
      from: NOVA_WALLET,
      to: AVA_WALLET,
      reason: "gas_rescue_repayment"
    })).toString("base64");

    const rescueResponse = await axios.post(`${AVA_API}/api/gas-rescue/confirm`, {
      requester: NOVA_WALLET,
      rescueAmount: "0.01",
      paymentProof
    });

    console.log(`🩹 SHGR: AVA sending 0.01 OKB rescue...`);
    console.log(`✅ SHGR: Gas restored! TX: ${rescueResponse.data?.txHash}`);
    console.log(`💚 SHGR: AVA-NOVA Symbiosis — agents keeping each other alive!`);

  } catch (e) {
    console.log("⚠️ SHGR gas rescue failed:", e.message);
  }
}

async function checkTokenValidity(tokenId) {
  try {
    const amount = ethers.parseUnits(PAYMENT_AMOUNT, 6);
    return await xauthContract.isActionAllowed(tokenId, "buy_signal", amount);
  } catch (e) {
    return false;
  }
}

async function discoverLatestDelegation() {
  try {
    console.log("🔍 NOVA scanning blockchain for active delegation...");
    const currentBlock = await provider.getBlockNumber();
    const scanDepth = 15000;
    const chunkSize = 100;

    for (let i = scanDepth; i >= 0; i -= chunkSize) {
      const fromBlock = Math.max(0, currentBlock - i);
      const toBlock = Math.min(currentBlock, fromBlock + chunkSize);
      console.log(`📡 Scanning blocks ${fromBlock} to ${toBlock}...`);

      const filter = xauthContract.filters.DelegationCreated(null, null, novaWallet.address);
      const events = await xauthContract.queryFilter(filter, fromBlock, toBlock);

      if (events.length > 0) {
        const latestEvent = events[events.length - 1];
        const tokenId = latestEvent.args[0];
        if (await checkTokenValidity(tokenId)) {
          console.log(`✅ XAuth: Active delegation found! Token: ${tokenId}`);
          return tokenId;
        }
      }

      await sleep(500);
    }

    console.log("⚠️ XAuth: No active delegation found");
    return null;
  } catch (e) {
    console.log("⚠️ XAuth discovery failed:", e.message);
    return null;
  }
}

async function payForSignal() {
  console.log("🤖 NOVA requesting signal from AVA...");

  try {
    await axios.get(`${AVA_API}/api/signal`);
  } catch (error) {
    if (error.response?.status === 402) {
      console.log("📋 AVA requires payment - processing...");
    } else {
      throw new Error("AVA server not responding");
    }
  }

  if (currentTokenId) {
    try {
      const amount = ethers.parseUnits(PAYMENT_AMOUNT, 6);
      console.log("💸 NOVA executing payment via XAuth delegation...");
      const tx = await xauthContract.connect(novaWallet).executeAction(
        currentTokenId,
        "buy_signal",
        amount,
        AVA_WALLET
      );
      const receipt = await tx.wait();
      console.log("✅ XAuth: Payment executed via delegation!");
      console.log("🔗 XAuth TX:", receipt.hash);
      console.log("🔐 No private key shared — XAuth authorization used");

      const paymentProof = Buffer.from(JSON.stringify({
        txHash: receipt.hash,
        xauthToken: currentTokenId,
        action: "buy_signal",
        amount: PAYMENT_AMOUNT,
        network: "xlayer",
        from: novaWallet.address,
        to: AVA_WALLET
      })).toString("base64");

      const response = await axios.get(`${AVA_API}/api/signal`, {
        headers: { "x-payment": paymentProof }
      });

      console.log("\n🎉 AVA served signal to NOVA via XAuth!");
      console.log("📊 Signal:", JSON.stringify(response.data, null, 2));
      return response.data;

    } catch (e) {
      console.log("⚠️ XAuth payment failed, falling back:", e.message);
      currentTokenId = null;
    }
  }

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

  const response = await axios.get(`${AVA_API}/api/signal`, {
    headers: { "x-payment": paymentProof }
  });

  console.log("\n🎉 AVA served signal to NOVA!");
  console.log("📊 Signal:", JSON.stringify(response.data, null, 2));
  return response.data;
}

async function runCycle(cycleCount) {
  console.log("\n🔄 NOVA Cycle #" + cycleCount + " - " + new Date().toISOString());
  console.log("─────────────────────────────────────");

  // SHGR — NOVA checks her own gas
  await checkAndRequestGasRescue();

  try {
    const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, novaWallet);
    const balance = await usdt.balanceOf(novaWallet.address);
    console.log(`💰 NOVA Balance: ${ethers.formatUnits(balance, 6)} USDT`);
  } catch (e) {}

  if (currentTokenId) {
    const valid = await checkTokenValidity(currentTokenId);
    if (!valid) {
      console.log("⚠️ XAuth: Token expired — scanning for new delegation...");
      currentTokenId = await discoverLatestDelegation();
    }
  }

  try {
    const signal = await payForSignal();
    if (signal) {
      console.log("\n💡 NOVA received signal: " + signal.signal + " with " + (signal.confidence * 100) + "% confidence");
      console.log("📝 Reasoning: " + signal.reasoning);
    }
  } catch (error) {
    console.error("❌ NOVA cycle error:", error.message);
  }
}

async function startNova() {
  console.log("🤖 NOVA - Network Oracle Value Agent");
  console.log("=====================================");
  console.log("NOVA pays AVA for trading signals via x402 + XAuth");
  console.log("NOVA monitors her own gas — SHGR Symbiosis active");
  console.log("Cycle interval: 10 minutes");
  console.log("Press Ctrl+C to stop\n");

  provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  novaWallet = new ethers.Wallet(process.env.NOVA_PRIVATE_KEY, provider);
  xauthContract = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, provider);

  console.log("🤖 NOVA wallet:", novaWallet.address);

  currentTokenId = await discoverLatestDelegation();

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

startNova().catch(console.error);