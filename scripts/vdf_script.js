const { ethers } = require("hardhat");

// Cấu hình địa chỉ
const CONFIG = {
  GATEWAY_A_ADDR: process.env.GATEWAY_A_ADDR || "",
  CHAIN_A_RPC: "http://localhost:8545",
};

/**
 * VDF Script - Mô phỏng Verifiable Delay Function
 * 
 * Workflow:
 * 1. Nhận input từ commitment
 * 2. Tính toán VDF (mô phỏng delay)
 * 3. Tạo proof
 * 4. Submit VDF proof lên ContractD qua Axelar
 */
async function main(sessionId, commitment) {
  if (!sessionId || !commitment) {
    console.error("❌ Usage: node vdf_script.js <sessionId> <commitment>");
    process.exit(1);
  }

  console.log(`⏱️  VDF Script - Session ${sessionId}`);
  console.log(`   Input (commitment): ${commitment}`);

  // Mô phỏng VDF computation (trong thực tế đây là quá trình tốn thời gian)
  console.log("   Computing VDF (simulating delay)...");
  await sleep(2000); // Giả lập 2 giây tính toán

  // Tạo VDF output và proof (mock)
  const vdfOutput = ethers.keccak256(
    ethers.solidityPacked(["bytes32", "string"], [commitment, "VDF_OUTPUT"])
  );
  const vdfProof = ethers.keccak256(
    ethers.solidityPacked(["bytes32", "string"], [vdfOutput, "VDF_PROOF"])
  );

  console.log(`   VDF Output (Y): ${vdfOutput}`);
  console.log(`   VDF Proof (π): ${vdfProof}`);

  // Gửi VDF proof lên Chain A Gateway
  const provider = new ethers.JsonRpcProvider(CONFIG.CHAIN_A_RPC);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const gatewayA = new ethers.Contract(
    CONFIG.GATEWAY_A_ADDR,
    ["function sendMessage(bytes calldata payload) external"],
    signer
  );

  // Tạo payload để gọi submitVDFProof trên ContractD
  const payload = ethers.concat([
    ethers.id("submitVDFProof(uint256,bytes32,bytes32)").slice(0, 10),
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "bytes32", "bytes32"],
      [sessionId, vdfOutput, vdfProof]
    )
  ]);

  console.log("🚀 Submitting VDF proof via Axelar...");
  const tx = await gatewayA.sendMessage(payload);
  await tx.wait();
  console.log(`✅ VDF proof submitted! Tx: ${tx.hash}`);

  return { vdfOutput, vdfProof };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export cho sử dụng từ script khác
module.exports = { main };

// Chạy trực tiếp
if (require.main === module) {
  const sessionId = process.argv[2];
  const commitment = process.argv[3];
  main(sessionId, commitment).catch(console.error);
}
