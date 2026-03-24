const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

  console.log("AVA Wallet:", wallet.address);

  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
  ];

  const tokens = [
    { name: "USDT", address: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d" },
    { name: "WETH", address: "0x5A77f1443D16ee5761d310e38b62f77f726bC71c" },
    { name: "WOKB", address: "0xe538905cf8410324e03a5a23c1c177a474d59b2b" },
    { name: "USDC", address: "0x74b7f16337b8972027f6196a17a631ac6de26d22" },
    { name: "OKB", address: "0x3F4B6664338F23d2397c953f2AB4Ce8031663f80" }
  ];

  for (const token of tokens) {
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const [balance, symbol, decimals] = await Promise.all([
        contract.balanceOf(wallet.address),
        contract.symbol(),
        contract.decimals()
      ]);
      const formatted = ethers.formatUnits(balance, decimals);
      if (parseFloat(formatted) > 0) {
        console.log(`✅ ${symbol}: ${formatted}`);
      } else {
        console.log(`⬜ ${symbol}: 0`);
      }
    } catch (e) {
      console.log(`❌ ${token.name}: error`);
    }
  }
}

main().catch(console.error);