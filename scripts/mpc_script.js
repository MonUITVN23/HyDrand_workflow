const { ethers } = require("hardhat");

// Cấu hình địa chỉ
const CONFIG = {
  GATEWAY_A_ADDR: process.env.GATEWAY_A_ADDR || "",
  CHAIN_A_RPC: "http://localhost:8545",
};

/**
 * MPC Script - Mô phỏng Multi-Party Computation
 * 
 * Workflow:
 * 1. Tạo seed ngẫu nhiên
 * 2. Tính commitment = H(seed)
 * 3. Gửi commitment lên ContractS
 * 4. Đợi VDF proof được verify
 * 5. Reveal seed
 */
async function main(sessionId) {
  if (!sessionId) {
    console.error("❌ Usage: node mpc_script.js <sessionId>");
    process.exit(1);
  }

  console.log(`🔐 MPC Script - Session ${sessionId}`);

  const provider = new ethers.JsonRpcProvider(CONFIG.CHAIN_A_RPC);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const gatewayA = new ethers.Contract(
    CONFIG.GATEWAY_A_ADDR,
    ["function sendMessage(bytes calldata payload) external"],
    signer
  );

  // Bước 1: Tạo seed ngẫu nhiên (trong thực tế, đây là kết quả MPC)
  const seed = ethers.randomBytes(32);
  const seedHash = ethers.keccak256(seed);
  
  console.log(`   Seed: ${ethers.hexlify(seed)}`);
  console.log(`   Commitment (H(seed)): ${seedHash}`);

  // Lưu seed để reveal sau
  const fs = require("fs");
  const seedData = {
    sessionId,
    seed: ethers.hexlify(seed),
    commitment: seedHash,
    timestamp: Date.now()
  };
  fs.writeFileSync(`./seed_${sessionId}.json`, JSON.stringify(seedData, null, 2));
  console.log(`✅ Seed saved to seed_${sessionId}.json`);

  return seedData;
}

/**
 * Reveal seed sau khi VDF proof được verify
 */
async function revealSeed(sessionId) {
  console.log(`\n🔓 Revealing seed for session ${sessionId}...`);

  const fs = require("fs");
  const seedData = JSON.parse(fs.readFileSync(`./seed_${sessionId}.json`, "utf8"));

  const provider = new ethers.JsonRpcProvider(CONFIG.CHAIN_A_RPC);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const gatewayA = new ethers.Contract(
    CONFIG.GATEWAY_A_ADDR,
    ["function sendMessage(bytes calldata payload) external"],
    signer
  );

  // Tạo payload để gọi submitSeed trên ContractD
  const payload = ethers.concat([
    ethers.id("submitSeed(uint256,bytes32)").slice(0, 10),
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "bytes32"],
      [sessionId, seedData.seed]
    )
  ]);

  console.log(`   Sending seed: ${seedData.seed}`);
  const tx = await gatewayA.sendMessage(payload);
  await tx.wait();
  console.log(`✅ Seed revealed! Tx: ${tx.hash}`);
}

// Export cho sử dụng từ script khác
module.exports = { main, revealSeed };

// Chạy trực tiếp
if (require.main === module) {
  const sessionId = process.argv[2];
  main(sessionId).catch(console.error);
}
