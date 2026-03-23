const { ethers } = require("ethers");

const wallet = ethers.Wallet.createRandom();
console.log("AVA Wallet Created!");
console.log("Address:", wallet.address);
console.log("Private Key:", wallet.privateKey);
console.log("\n⚠️ Copy the Private Key into your .env file as AGENT_PRIVATE_KEY");