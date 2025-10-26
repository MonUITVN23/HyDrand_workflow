const { ethers } = require("hardhat");
const mpcScript = require("./mpc_script");
const vdfScript = require("./vdf_script");

/**
 * Orchestration Script - Chạy toàn bộ workflow DRNG
 * 
 * Workflow đầy đủ:
 * 1. Request randomness từ ContractS
 * 2. MPC tạo seed và commitment
 * 3. Submit commitment lên ContractS
 * 4. VDF compute và submit proof
 * 5. MPC reveal seed
 * 6. ContractD verify và gửi randomness cuối cùng
 */

const CONFIG = {
  CONTRACT_S_ADDR: process.env.CONTRACT_S_ADDR || "",
  CONTRACT_D_ADDR: process.env.CONTRACT_D_ADDR || "",
  VERIFIER_B_ADDR: process.env.VERIFIER_B_ADDR || "",
  GATEWAY_A_ADDR: process.env.GATEWAY_A_ADDR || "",
  CHAIN_A_RPC: "http://localhost:8545",
  CHAIN_B_RPC: "http://localhost:9545",
};

async function main() {
  console.log("🎲 Starting DRNG Full Workflow Test\n");
  console.log("=" .repeat(60));

  if (!CONFIG.CONTRACT_S_ADDR || !CONFIG.CONTRACT_D_ADDR) {
    console.error("❌ Please set environment variables:");
    console.error("   CONTRACT_S_ADDR, CONTRACT_D_ADDR, VERIFIER_B_ADDR, GATEWAY_A_ADDR");
    console.error("\nRun deploy.js first and export the addresses.");
    process.exit(1);
  }

  const sessionId = Date.now(); // Sử dụng timestamp làm session ID
  console.log(`📋 Session ID: ${sessionId}\n`);

  // Setup providers và contracts
  const providerA = new ethers.JsonRpcProvider(CONFIG.CHAIN_A_RPC);
  const providerB = new ethers.JsonRpcProvider(CONFIG.CHAIN_B_RPC);
  const signerA = new ethers.Wallet(process.env.PRIVATE_KEY, providerA);
  const signerB = new ethers.Wallet(process.env.PRIVATE_KEY, providerB);

  const contractS = new ethers.Contract(
    CONFIG.CONTRACT_S_ADDR,
    [
      "function RequestRandomness(uint256 _sessionId) external",
      "function SubmitCommitment(bytes32 _commitment) external",
      "function currentSessionId() view returns (uint256)",
      "function currentCommitment() view returns (bytes32)",
      "event RandomnessRequested(uint256 indexed sessionId)",
      "event CommitmentSubmitted(uint256 indexed sessionId, bytes32 commitment)"
    ],
    signerA
  );

  const contractD = new ethers.Contract(
    CONFIG.CONTRACT_D_ADDR,
    [
      "function commitments(uint256) view returns (bytes32)",
      "function vdfOutputs(uint256) view returns (bytes32)",
      "event VDFProofVerified(uint256 indexed sessionId, bool success)"
    ],
    providerB
  );

  const verifier = new ethers.Contract(
    CONFIG.VERIFIER_B_ADDR,
    [
      "function lastRandomness() view returns (bytes32)",
      "function lastSessionId() view returns (uint256)",
      "event RandomnessDelivered(uint256 indexed sessionId, bytes32 randomness)"
    ],
    providerB
  );

  // ============================================================
  // BƯỚC 1: Request Randomness
  // ============================================================
  console.log("Step 1️⃣ : Requesting randomness from ContractS...");
  const tx1 = await contractS.RequestRandomness(sessionId);
  await tx1.wait();
  console.log(`✅ Randomness requested! Tx: ${tx1.hash}\n`);
  
  // Wait for nonce to update
  await sleep(1000);

  // ============================================================
  // BƯỚC 2: MPC tạo seed và commitment
  // ============================================================
  console.log("Step 2️⃣ : MPC generating seed and commitment...");
  const seedData = await mpcScript.main(sessionId);
  console.log();

  // ============================================================
  // BƯỚC 3: Submit Commitment
  // ============================================================
  console.log("Step 3️⃣ : Submitting commitment to ContractS...");
  const tx3 = await contractS.SubmitCommitment(seedData.commitment);
  await tx3.wait();
  console.log(`✅ Commitment submitted! Tx: ${tx3.hash}`);
  
  // Đợi relayer chuyển tiếp
  console.log("⏳ Waiting for relayer to forward commitment to Chain B...");
  await sleep(5000);
  
  const storedCommitment = await contractD.commitments(sessionId);
  console.log(`✅ Commitment stored on Chain B: ${storedCommitment}\n`);

  // ============================================================
  // BƯỚC 4: VDF Compute và Submit Proof
  // ============================================================
  console.log("Step 4️⃣ : VDF computing proof...");
  await vdfScript.main(sessionId, seedData.commitment);
  
  // Đợi relayer chuyển tiếp
  console.log("⏳ Waiting for relayer to forward VDF proof to Chain B...");
  await sleep(5000);
  
  const vdfOutput = await contractD.vdfOutputs(sessionId);
  console.log(`✅ VDF output stored on Chain B: ${vdfOutput}\n`);

  // ============================================================
  // BƯỚC 5: MPC Reveal Seed
  // ============================================================
  console.log("Step 5️⃣ : MPC revealing seed...");
  await mpcScript.revealSeed(sessionId);
  
  // Đợi relayer chuyển tiếp và xử lý
  console.log("⏳ Waiting for relayer to forward seed and final computation...");
  await sleep(5000);

  // ============================================================
  // BƯỚC 6: Kiểm tra kết quả cuối cùng
  // ============================================================
  console.log("\nStep 6️⃣ : Checking final randomness...");
  const lastSessionId = await verifier.lastSessionId();
  const lastRandomness = await verifier.lastRandomness();

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DRNG WORKFLOW COMPLETED!");
  console.log("=".repeat(60));
  console.log(`Session ID: ${lastSessionId.toString()}`);
  console.log(`Final Randomness: ${lastRandomness}`);
  console.log("=".repeat(60));

  if (lastSessionId.toString() === sessionId.toString()) {
    console.log("✅ SUCCESS: Randomness delivered correctly!");
  } else {
    console.log("❌ WARNING: Session ID mismatch!");
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("\n❌ Error in workflow:", error);
  process.exit(1);
});
