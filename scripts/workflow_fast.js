/**
 * Fast DRNG Workflow (No Axelar Wait)
 * 
 * Skips Axelar relay wait - submits commitment directly
 * Use for quick testing of MPC + VDF components
 */

const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

const { MPCNode, MPCCoordinator } = require("./mpc_simulation");
const { PietrzakVDF, N_DEMO } = require("./vdf_implementation");

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     Fast DRNG: MPC + Pietrzak VDF (Direct Submission)        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const CONTRACT_D_ADDR = process.env.CONTRACT_D_ADDR;
  const VERIFIER_B_ADDR = process.env.VERIFIER_B_ADDR;

  if (!CONTRACT_D_ADDR) {
    throw new Error("Missing CONTRACT_D_ADDR in .env");
  }

  const sessionId = Math.floor(Date.now() / 1000);
  
  const amoyProvider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  const amoySigner = new ethers.Wallet(PRIVATE_KEY, amoyProvider);

  console.log(`📋 Session ID: ${sessionId}`);
  console.log(`👛 Operator: ${amoySigner.address}\n`);

  // ══════════════════════════════════════════════════════════════════
  // STEP 1: MPC DISTRIBUTED SEED GENERATION
  // ══════════════════════════════════════════════════════════════════
  console.log("═".repeat(65));
  console.log("│ STEP 1: MPC Distributed Seed Generation (3-of-5 Threshold)   │");
  console.log("═".repeat(65));
  
  const N_NODES = 5;
  const THRESHOLD = 3;

  console.log(`\n👥 Initializing ${N_NODES} MPC nodes...`);
  const nodes = [];
  for (let i = 1; i <= N_NODES; i++) {
    const privateKey = ethers.keccak256(
      ethers.toUtf8Bytes(`drng_mpc_node_${i}_session_${sessionId}`)
    );
    const node = new MPCNode(i, privateKey);
    nodes.push(node);
    console.log(`   Node ${i}: ${node.wallet.address.slice(0, 18)}...`);
  }

  const coordinator = new MPCCoordinator(nodes, THRESHOLD);

  await coordinator.collectCommitments(sessionId);
  await coordinator.collectReveals();
  const combinedSeed = coordinator.combineSeed();
  coordinator.distributeSharesToNodes();

  const seedHex = ethers.toBeHex(combinedSeed, 32);
  const commitment = ethers.keccak256(seedHex);
  
  console.log(`\n📊 MPC Result:`);
  console.log(`   Combined Seed: ${seedHex.slice(0, 34)}...`);
  console.log(`   Commitment:    ${commitment}`);

  // ══════════════════════════════════════════════════════════════════
  // STEP 2: PIETRZAK VDF COMPUTATION
  // ══════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("│ STEP 2: Pietrzak VDF - Verifiable Delay Function             │");
  console.log("═".repeat(65));

  const T = 8192; // 2^13
  const vdf = new PietrzakVDF(N_DEMO, T);

  console.log(`\n⚙️  VDF Configuration:`);
  console.log(`   T (squarings):  ${T} (2^${Math.log2(T)})`);
  console.log(`   Modulus bits:   ${N_DEMO.toString(2).length}`);

  const x = BigInt(seedHex) % N_DEMO;
  
  const evalStart = Date.now();
  const y = vdf.eval(x);
  const evalTime = Date.now() - evalStart;

  const proofStart = Date.now();
  const vdfProof = vdf.prove(x, y);
  const proofTime = Date.now() - proofStart;
  console.log(`   Proof size: ${vdfProof.length} elements`);

  const verifyStart = Date.now();
  const vdfValid = vdf.verify(x, y, vdfProof);
  const verifyTime = Date.now() - verifyStart;

  const vdfOutputBytes32 = ethers.toBeHex(y % (2n ** 256n), 32);
  const vdfProofHash = ethers.keccak256(
    ethers.toUtf8Bytes(vdfProof.map(p => p.toString()).join(','))
  );

  // ══════════════════════════════════════════════════════════════════
  // STEP 3: DIRECT SUBMISSION TO CONTRACTD (AMOY)
  // ══════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("│ STEP 3: Submit to ContractD (Polygon Amoy) - Direct          │");
  console.log("═".repeat(65));

  const ContractD_ABI = [
    "function commitments(uint256) view returns (bytes32)",
    "function vdfOutputs(uint256) view returns (bytes32)",
    "function submitVDFProof(uint256, bytes32, bytes32) external",
    "function submitSeed(uint256, bytes32) external",
    "function storeCommitment(uint256, bytes32) external"
  ];
  
  const contractD = new ethers.Contract(CONTRACT_D_ADDR, ContractD_ABI, amoySigner);

  // 3a: Store commitment directly
  console.log(`\n📤 Storing commitment directly...`);
  try {
    const tx1 = await contractD.storeCommitment(sessionId, commitment, { gasLimit: 100000 });
    await tx1.wait();
    console.log(`   ✅ Commitment stored! Tx: ${tx1.hash}`);
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
  }

  // 3b: Submit VDF proof
  console.log(`\n📤 Submitting VDF output...`);
  try {
    const tx2 = await contractD.submitVDFProof(sessionId, vdfOutputBytes32, vdfProofHash, { gasLimit: 200000 });
    await tx2.wait();
    console.log(`   ✅ VDF submitted! Tx: ${tx2.hash}`);
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 4: MPC THRESHOLD RECONSTRUCTION & SUBMIT SEED
  // ══════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("│ STEP 4: MPC Threshold Reconstruction & Submit Seed           │");
  console.log("═".repeat(65));
  
  const availableNodes = [1, 2, 4];
  console.log(`\n🔓 Reconstructing seed with nodes: ${availableNodes.join(', ')}`);
  
  const reconstructed = coordinator.reconstructSeed(availableNodes);
  const reconstructedHex = ethers.toBeHex(reconstructed, 32);
  
  console.log(`   Match: ${reconstructed === combinedSeed ? '✅ YES' : '❌ NO'}`);

  console.log(`\n📤 Submitting seed...`);
  try {
    const tx3 = await contractD.submitSeed(sessionId, reconstructedHex, { gasLimit: 200000 });
    await tx3.wait();
    console.log(`   ✅ Seed submitted! Tx: ${tx3.hash}`);
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 5: VERIFY FINAL RANDOMNESS
  // ══════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("│ STEP 5: Verify Final Randomness                              │");
  console.log("═".repeat(65));

  const Verifier_ABI = ["function randomness(uint256) view returns (bytes32)"];
  const verifier = new ethers.Contract(VERIFIER_B_ADDR, Verifier_ABI, amoyProvider);

  const finalRandomness = await verifier.randomness(sessionId);
  const expectedRandomness = ethers.keccak256(
    ethers.concat([vdfOutputBytes32, reconstructedHex])
  );

  // ══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════
  console.log("\n" + "╔".padEnd(64, "═") + "╗");
  console.log("║" + "  🎉 FAST DRNG COMPLETE".padEnd(63) + "║");
  console.log("╚".padEnd(64, "═") + "╝");

  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ RESULTS                                                         │
├─────────────────────────────────────────────────────────────────┤
│ Session ID:       ${sessionId}                                  │
│ MPC Nodes:        ${N_NODES} (threshold ${THRESHOLD})                             │
│ VDF Squarings:    ${T} (${evalTime}ms eval, ${verifyTime}ms verify)              │
│ Commitment:       ${commitment.slice(0, 42)}...  │
│ VDF Output:       ${vdfOutputBytes32.slice(0, 42)}...  │
│ Final Randomness: ${finalRandomness.slice(0, 42)}...  │
│ Expected:         ${expectedRandomness.slice(0, 42)}...  │
│ Match:            ${finalRandomness === expectedRandomness ? '✅ YES' : '❌ NO'}                                           │
└─────────────────────────────────────────────────────────────────┘
`);

  // Save session
  fs.writeFileSync(
    `./drng_session_${sessionId}.json`,
    JSON.stringify({
      sessionId,
      mpc: { nodes: N_NODES, threshold: THRESHOLD, seed: seedHex, commitment },
      vdf: { T, output: vdfOutputBytes32, proofHash: vdfProofHash, evalTime, verifyTime, valid: vdfValid },
      finalRandomness,
      match: finalRandomness === expectedRandomness,
      timestamp: Date.now()
    }, null, 2)
  );
  console.log(`📁 Session saved: ./drng_session_${sessionId}.json\n`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
