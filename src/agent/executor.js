const { ethers } = require("ethers");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";
const WETH_ADDRESS = "0x5A77f1443D16ee5761d310e38b62f77f726bC71c";
const REPUTATION_CONTRACT = "0xDfe2C8eCB7a247c504D4F4858b1eC3a97193F986";

const REPUTATION_ABI = [
  "function recordTrade(bool success, uint256 usdtAmount) external",
  "function recordSignalSold(address buyer, uint256 price) external",
  "function getReputation() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
  "function getSignalPrice() public view returns (uint256)"
];

const DEX_ROUTER = "0xD1b8997AaC08c619d40Be2e4284c9C72cAB33954";
const TOKEN_APPROVAL = "0x8b773D83bc66Be128c60e07E17C8901f7a64F000";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)"
];

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

  const response = await axios.get(
    `https://web3.okx.com${requestPath}${queryString}`,
    { headers }
  );

  if (response.data.code !== "0" || !response.data.data?.[0]) {
    throw new Error(`Quote failed: ${response.data.msg}`);
  }

  return response.data.data[0].tx;
}

async function approveToken(tokenAddress, amount, wallet) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const allowance = await contract.allowance(wallet.address, TOKEN_APPROVAL);

  if (BigInt(allowance) < BigInt(amount)) {
    console.log("📝 Approving token...");
    const tx = await contract.approve(TOKEN_APPROVAL, ethers.MaxUint256);
    await tx.wait();
    console.log("✅ Approved");
  } else {
    console.log("✅ Already approved");
  }
}

async function sendSwap(txData, wallet, decision) {
  const tx = await wallet.sendTransaction({
    to: DEX_ROUTER,
    data: txData.data,
    value: BigInt(txData.value || "0"),
    gasLimit: BigInt(txData.gas || "800000"),
    gasPrice: BigInt(txData.gasPrice || "50000000")
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
      await reputationContract.recordTrade(true, usdtAmount);
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
      await reputationContract.recordTrade(false, usdtAmount);
      console.log("✅ Failed trade recorded onchain");
    } catch (e) {
      console.log("⚠️ Reputation update skipped:", e.message);
    }

    return null;
  }
}

async function executeSwap(decision) {
  if (decision.action === "HOLD") {
    console.log("⏸️  AVA decided to HOLD");
    return null;
  }

  if (decision.confidence < 0.65) {
    console.log(`⚠️  Confidence too low (${decision.confidence})`);
    return null;
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

  try {
    if (decision.action === "BUY") {
      console.log("🔄 AVA buying WETH with $1 USDT...");
      const amount = ethers.parseUnits("1", 6).toString();

      await approveToken(USDT_ADDRESS, amount, wallet);

      console.log("📊 Getting quote...");
      const txData = await getQuote(USDT_ADDRESS, WETH_ADDRESS, amount, wallet.address);

      return await sendSwap(txData, wallet, decision);

    } else if (decision.action === "SELL") {
      console.log("🔄 AVA selling WETH → USDT...");

      const wethContract = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);
      const wethBalance = await wethContract.balanceOf(wallet.address);

      if (BigInt(wethBalance) === 0n) {
        console.log("⚠️  No WETH to sell");
        return null;
      }

      console.log(`💰 WETH balance: ${ethers.formatEther(wethBalance)}`);

      await approveToken(WETH_ADDRESS, wethBalance.toString(), wallet);

      console.log("📊 Getting quote...");
      const txData = await getQuote(
        WETH_ADDRESS,
        USDT_ADDRESS,
        wethBalance.toString(),
        wallet.address
      );

      return await sendSwap(txData, wallet, decision);
    }

  } catch (error) {
    console.error("❌ Swap failed:", error.message);
    if (error.response) {
      console.error("Response:", JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

module.exports = { executeSwap };