const { ethers } = require("ethers");
require("dotenv").config();

const USDT_ADDRESS = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
  
  const okbBalance = await provider.getBalance(wallet.address);
  
  const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
  const usdtBalance = await usdt.balanceOf(wallet.address);
  const decimals = await usdt.decimals();

  console.log("✅ AVA Wallet Status");
  console.log("Address:", wallet.address);
  console.log("OKB Balance:", ethers.formatEther(okbBalance), "OKB");
  console.log("USDT Balance:", ethers.formatUnits(usdtBalance, decimals), "USDT");
}

main().catch(console.error);