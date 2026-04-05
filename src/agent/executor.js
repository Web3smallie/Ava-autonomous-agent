const { ethers } = require("ethers");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
const WETH_ADDRESS = "0x5A77f1443D16ee5761d310e38b62f77f726bC71c";
const REPUTATION_CONTRACT = "0xa45aACfC36B184Ef08C600DECACC4DC310ab0B1C";
const COMMIT_CONTRACT = "0x0f0D2CfaD46165595DF5F7986bC77Fa65Fe1c412";
const PROOF_CONTRACT = "0xA7019A7D192BE0Fb9Da4EC1CD43eA59AA06E8026";
const XAUTH_CONTRACT = "0x68b9Ab523B6C7D4fb732C4a886E570400FFF8B50";
const SHADOWLEDGER_CONTRACT = "0xc7Dbf29bd9ADEfDD98344db756e35ECE8758C6C1";

const REPUTATION_ABI = [
  "function recordTrade(bool success, uint256 usdtAmount) external",
  "function getSignalPrice() public view returns (uint256)"
];

const COMMIT_ABI = [
  "function commitDecision(bytes32 commitHash) external returns (uint256)",
  "function revealDecision(uint256 commitId, string calldata action, bytes32 salt) external"
];

const PROOF_ABI = [
  "function proveAutonomousExecution(bytes32 codeHash, uint256 cycleNumber, string calldata action) external returns (uint256)"
];

const XAUTH_ABI = [
  "function grantDelegation((address worker, string[] allowedActions, address targetContract, uint256 budgetAmount, uint256 durationSeconds, string priceSymbol, uint256 minPrice, uint256 maxPrice, string metadata) params) external returns (bytes32)",
  "function isActionAllowed(bytes32 tokenId, string calldata action, uint256 amount) external view returns (bool)"
];

const SHADOWLEDGER_ABI = [
  "function recordIntent(bytes32 reasoningHash, string calldata ipfsMetadata, string calldata action, uint256 rsi, int256 macd, uint256 ethPrice, uint256 accessPrice) external returns (uint256)",
  "function recordOutcome(uint256 intentId, bool wasSuccessful) external"
];

const DEX_ROUTER = "0xD1b8997AaC08c619d40Be2e4284c9C72cAB33954";
const TOKEN_APPROVAL = "0x8b773D83bc66Be128c60e07E17C8901f7a64F000";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)"
];

const CODE_HASH = ethers.keccak256(ethers.toUtf8Bytes("AVA-autonomous-agent-v2-xlayer"));

let executionCycle = 0;
let activeTokenId = null;
let tokenExpiry = 0;
let currentNonce = null;

// Nonce manager — prevents nonce conflicts
async function getNextNonce(provider, address) {
  const onchainNonce = await provider.getTransactionCount(address, "pending");
  if (currentNonce === null || onchainNonce > currentNonce) {
    currentNonce = onchainNonce;
  } else {
    currentNonce++;
  }
  return currentNonce;
}

function getHeaders(timestamp, method, path, queryString = "") {
  const message = timestamp + method + path + queryString;
  const signature = crypto
    .createHmac("sha256", process.env.OKX_WEB3_SECRET_KEY)
    .update(message)
    .digest("base64");
  return {
    "OK-ACCESS-KEY": process.env.OKX_WEB3_API_KEY,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": process.env.OKX_WEB3_PASSPHRASE,
    "OK-ACCESS-PROJECT": process.env.OKX_PROJECT_ID,
    "Content-Type": "application/json"
  };
}

async function recordIntentToShadowLedger(decision, marketData, wallet, provider) {
  try {
    const shadowLedger = new ethers.Contract(SHADOWLEDGER_CONTRACT, SHADOWLEDGER_ABI, wallet);
    const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes(decision.reasoning));
    const rsi = Math.round((marketData?.technicalAnalysis?.rsi || 0) * 100);
    const macd = Math.round((marketData?.technicalAnalysis?.macd?.macd || 0) * 100);
    const ethPrice = Math.round((marketData?.price || 0) * 100);
    const accessPrice = ethers.parseUnits("0.001", 6);
    const nonce = await getNextNonce(provider, wallet.address);

    console.log("📝 ShadowLedger: Recording intent onchain...");
    const tx = await shadowLedger.recordIntent(
      reasoningHash,
      decision.reasoning,
      decision.action,
      rsi,
      macd,
      ethPrice,
      accessPrice,
      { gasPrice: ethers.parseUnits("0.1", "gwei"), nonce }
    );
    const receipt = await tx.wait();
    const intentId = receipt.logs[0]?.topics?.[1];
    console.log(`📝 ShadowLedger: Intent recorded! ID: ${intentId}`);
    console.log(`🔗 View: https://explorer.xlayer.tech/tx/${tx.hash}`);
    return intentId;
  } catch (e) {
    console.log("⚠️ ShadowLedger intent skipped:", e.message);
    return null;
  }
}

async function recordOutcomeToShadowLedger(intentId, wasSuccessful, wallet, provider) {
  try {
    if (!intentId) return;
    const shadowLedger = new ethers.Contract(SHADOWLEDGER_CONTRACT, SHADOWLEDGER_ABI, wallet);
    const nonce = await getNextNonce(provider, wallet.address);
    const tx = await shadowLedger.recordOutcome(intentId, wasSuccessful, {
      gasPrice: ethers.parseUnits("0.1", "gwei"),
      nonce
    });
    await tx.wait();
    console.log(`✅ ShadowLedger: Outcome recorded — ${wasSuccessful ? "SUCCESS" : "FAILED"}`);
  } catch (e) {
    console.log("⚠️ ShadowLedger outcome skipped:", e.message);
  }
}

async function ensureNOVADelegation(wallet, provider) {
  try {
    const now = Math.floor(Date.now() / 1000);
    if (activeTokenId && tokenExpiry > now + 300) {
      console.log(`🔑 XAuth: Active delegation token exists`);
      return activeTokenId;
    }

    const novaWallet = process.env.NOVA_WALLET_ADDRESS;
    if (!novaWallet) return null;

    const xauth = new ethers.Contract(XAUTH_CONTRACT, XAUTH_ABI, wallet);
    const budget = ethers.parseUnits("0.05", 6);
    const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, wallet);
    const allowance = await usdt.allowance(wallet.address, XAUTH_CONTRACT);

    if (BigInt(allowance) < BigInt(budget)) {
      const nonce = await getNextNonce(provider, wallet.address);
      const approveTx = await usdt.approve(XAUTH_CONTRACT, ethers.MaxUint256, { nonce });
      await approveTx.wait();
      console.log("✅ XAuth: USDT approved for escrow");
    }

    const params = {
      worker: novaWallet,
      allowedActions: ["buy_signal", "fetch_analysis", "read_report"],
      targetContract: ethers.ZeroAddress,
      budgetAmount: budget,
      durationSeconds: 3600,
      priceSymbol: "",
      minPrice: 0,
      maxPrice: 0,
      metadata: "NOVA authorized to buy AVA signals for 1 hour"
    };

    const nonce = await getNextNonce(provider, wallet.address);
    const tx = await xauth.grantDelegation(params, { nonce });
    const receipt = await tx.wait();
    const tokenId = receipt.logs[0]?.topics?.[1];

    activeTokenId = tokenId;
    tokenExpiry = now + 3600;

    console.log(`✅ XAuth: Delegation granted to NOVA`);
    console.log(`🎫 Token: ${tokenId}`);
    return tokenId;
  } catch (e) {
    console.log("⚠️ XAuth delegation skipped:", e.message);
    return null;
  }
}

async function getQuote(fromToken, toToken, amount, walletAddress) {
  const requestPath = "/api/v6/dex/aggregator/swap";
  const params = {
    chainIndex: "196",
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    amount: amount,
    slippagePercent: "1",
    userWalletAddress: walletAddress
  };
  const queryString = "?" + new URLSearchParams(params).toString();
  const timestamp = new Date().toISOString();
  const headers = getHeaders(timestamp, "GET", requestPath, queryString);
  const response = await axios.get(`https://web3.okx.com${requestPath}${queryString}`, { headers });
  if (response.data.code !== "0" || !response.data.data?.[0]) {
    throw new Error(`Quote failed: ${response.data.msg}`);
  }
  return response.data.data[0].tx;
}

async function approveToken(tokenAddress, amount, wallet, provider) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const allowance = await contract.allowance(wallet.address, TOKEN_APPROVAL);
  if (BigInt(allowance) < BigInt(amount)) {
    console.log("📝 Approving token...");
    const nonce = await getNextNonce(provider, wallet.address);
    const tx = await contract.approve(TOKEN_APPROVAL, ethers.MaxUint256, { nonce });
    await tx.wait();
    console.log("✅ Approved");
  } else {
    console.log("✅ Already approved");
  }
}

async function proveAutonomousExecution(decision, wallet, provider) {
  try {
    const proofContract = new ethers.Contract(PROOF_CONTRACT, PROOF_ABI, wallet);
    const nonce = await getNextNonce(provider, wallet.address);
    const tx = await proofContract.proveAutonomousExecution(
      CODE_HASH, executionCycle, decision.action, { nonce }
    );
    await tx.wait();
    console.log(`✅ Autonomous execution proved onchain (Cycle #${executionCycle})`);
  } catch (e) {
    console.log("⚠️ Proof skipped:", e.message);
  }
}

async function commitDecision(decision, wallet, provider) {
  try {
    const salt = ethers.id(Date.now().toString());
    const commitHash = ethers.keccak256(
      ethers.solidityPacked(["string", "bytes32"], [decision.action, salt])
    );
    const commitContract = new ethers.Contract(COMMIT_CONTRACT, COMMIT_ABI, wallet);
    const nonce = await getNextNonce(provider, wallet.address);
    const tx = await commitContract.commitDecision(commitHash, { nonce });
    const receipt = await tx.wait();
    const commitId = receipt.logs[0]?.topics?.[1];
    console.log(`🔒 Decision committed onchain: ${decision.action} (ID: ${commitId})`);
    return { commitId, salt };
  } catch (e) {
    console.log("⚠️ Commit skipped:", e.message);
    return null;
  }
}

async function revealDecision(commitId, action, salt, wallet, provider) {
  try {
    const commitContract = new ethers.Contract(COMMIT_CONTRACT, COMMIT_ABI, wallet);
    const nonce = await getNextNonce(provider, wallet.address);
    await commitContract.revealDecision(commitId, action, salt, { nonce });
    console.log(`🔓 Decision revealed onchain: ${action}`);
  } catch (e) {
    console.log("⚠️ Reveal skipped:", e.message);
  }
}

async function sendSwap(txData, wallet, decision, provider) {
  const nonce = await getNextNonce(provider, wallet.address);
  const tx = await wallet.sendTransaction({
    to: DEX_ROUTER,
    data: txData.data,
    value: BigInt(txData.value || "0"),
    gasLimit: BigInt(txData.gas || "800000"),
    gasPrice: BigInt(txData.gasPrice || "50000000"),
    nonce
  });
  console.log("✅ Transaction sent!");
  console.log("🔗 TX Hash:", tx.hash);
  console.log("🌐 View: https://explorer.xlayer.tech/tx/" + tx.hash);
  const receipt = await tx.wait();

  if (receipt.status === 1) {
    console.log("🎉 SWAP SUCCESSFUL! Block:", receipt.blockNumber);
    try {
      const reputationContract = new ethers.Contract(REPUTATION_CONTRACT, REPUTATION_ABI, wallet);
      const usdtAmount = ethers.parseUnits((decision?.amount_usdt || 1).toString(), 6);
      const repNonce = await getNextNonce(provider, wallet.address);
      await reputationContract.recordTrade(true, usdtAmount, { nonce: repNonce });
      console.log("✅ Reputation updated onchain");
    } catch (e) {
      console.log("⚠️ Reputation update skipped:", e.message);
    }
    return tx.hash;
  } else {
    console.log("❌ Swap reverted");
    try {
      const reputationContract = new ethers.Contract(REPUTATION_CONTRACT, REPUTATION_ABI, wallet);
      const usdtAmount = ethers.parseUnits((decision?.amount_usdt || 1).toString(), 6);
      const repNonce = await getNextNonce(provider, wallet.address);
      await reputationContract.recordTrade(false, usdtAmount, { nonce: repNonce });
    } catch (e) {}
    return null;
  }
}

async function executeSwap(decision, marketData) {
  if (decision.action === "HOLD") {
    console.log("⏸️  AVA decided to HOLD");
    return null;
  }
  if (decision.confidence < 0.50) {
    console.log(`⚠️  Confidence too low (${decision.confidence})`);
    return null;
  }

  executionCycle++;
  currentNonce = null; // Reset nonce manager for each trade cycle

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

  // Ensure NOVA has active delegation
  await ensureNOVADelegation(wallet, provider);

  // STEP 1: Record intent to ShadowLedger BEFORE trade
  const intentId = await recordIntentToShadowLedger(decision, marketData, wallet, provider);

  try {
    let txHash = null;

    if (decision.action === "BUY") {
      console.log("🔄 AVA buying WETH with $1 USDT...");
      const amount = ethers.parseUnits("1", 6).toString();
      await approveToken(USDT_ADDRESS, amount, wallet, provider);
      console.log("📊 Getting quote...");
      const txData = await getQuote(USDT_ADDRESS, WETH_ADDRESS, amount, wallet.address);
      await proveAutonomousExecution(decision, wallet, provider);
      const commit = await commitDecision(decision, wallet, provider);
      txHash = await sendSwap(txData, wallet, decision, provider);
      if (commit) await revealDecision(commit.commitId, decision.action, commit.salt, wallet, provider);

    } else if (decision.action === "SELL") {
      console.log("🔄 AVA selling WETH → USDT...");
      const wethContract = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);
      const wethBalance = await wethContract.balanceOf(wallet.address);
      if (BigInt(wethBalance) === 0n) {
        console.log("⚠️  No WETH to sell");
        await recordOutcomeToShadowLedger(intentId, false, wallet, provider);
        return null;
      }
      console.log(`💰 WETH balance: ${ethers.formatEther(wethBalance)}`);
      await approveToken(WETH_ADDRESS, wethBalance.toString(), wallet, provider);
      console.log("📊 Getting quote...");
      const txData = await getQuote(WETH_ADDRESS, USDT_ADDRESS, wethBalance.toString(), wallet.address);
      await proveAutonomousExecution(decision, wallet, provider);
      const commit = await commitDecision(decision, wallet, provider);
      txHash = await sendSwap(txData, wallet, decision, provider);
      if (commit) await revealDecision(commit.commitId, decision.action, commit.salt, wallet, provider);
    }

    // STEP 3: Record outcome to ShadowLedger AFTER trade
    await recordOutcomeToShadowLedger(intentId, txHash !== null, wallet, provider);

    console.log(`✅ Trade complete! TX: ${txHash}`);
    return txHash;

  } catch (error) {
    console.error("❌ Swap failed:", error.message);
    await recordOutcomeToShadowLedger(intentId, false, wallet, provider);
    return null;
  }
}

module.exports = { executeSwap, activeTokenId: () => activeTokenId };