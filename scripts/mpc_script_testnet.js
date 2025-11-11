const { ethers } = require("hardhat");
const { sendViaAxelar } = require("./axelar_helper_testnet");
require("dotenv").config();

async function main(sessionId) {
  if (!sessionId) {
    console.error("❌ Usage: node mpc_script_testnet.js <sessionId>");
    process.exit(1);
  }

  console.log(`🔐 MPC Script - Session ${sessionId}\n`);

  // Generate seed
  const seed = ethers.randomBytes(32);
  const seedHash = ethers.keccak256(seed);

  console.log(`   Seed: ${ethers.hexlify(seed)}`);
  console.log(`   Commitment: ${seedHash}\n`);

  // Save to file
  const fs = require("fs");
  const seedData = {
    sessionId,
    seed: ethers.hexlify(seed),
    commitment: seedHash,
    timestamp: Date.now()
  };
  fs.writeFileSync(`./seed_${sessionId}.json`, JSON.stringify(seedData, null, 2));

  // Send commitment via Axelar
  console.log("📤 Sending commitment via Axelar...");
  await sendViaAxelar({
    srcChain: "ethereum-sepolia",
    destChain: "Polygon", // Axelar name for Mumbai
    destAddress: process.env.CONTRACT_D_ADDR,
    functionSignature: "storeCommitment(uint256,bytes32)",
    params: [sessionId, seedHash]
  });

  return seedData;
}

async function revealSeed(sessionId) {
  console.log(`\n🔓 Revealing seed for session ${sessionId}...\n`);

  const fs = require("fs");
  const seedData = JSON.parse(fs.readFileSync(`./seed_${sessionId}.json`, "utf8"));

  console.log(`   Seed: ${seedData.seed}`);

  // Send seed via Axelar
  console.log("📤 Sending seed via Axelar...");
  await sendViaAxelar({
    srcChain: "ethereum-sepolia",
    destChain: "Polygon",
    destAddress: process.env.CONTRACT_D_ADDR,
    functionSignature: "submitSeed(uint256,bytes32)",
    params: [sessionId, seedData.seed]
  });
}

module.exports = { main, revealSeed };

if (require.main === module) {
  const sessionId = process.argv[2];
  main(sessionId).catch(console.error);
}