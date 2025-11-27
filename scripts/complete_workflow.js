/**
 * Complete DRNG Workflow with MPC + Pietrzak VDF + Axelar
 * 
 * Full cryptographic pipeline:
 * 1. MPC (3-of-5 threshold) generates distributed seed
 * 2. Pietrzak VDF creates verifiable delay
 * 3. Axelar relays cross-chain
 * 4. On-chain verification and randomness generation
 */

const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

// Import modules
const { MPCNode, MPCCoordinator } = require("./mpc_simulation");
const { PietrzakVDF, N_DEMO } = require("./vdf_implementation");

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     Complete DRNG: MPC + Pietrzak VDF + Axelar Gateway       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const CONTRACT_S_ADDR = process.env.CONTRACT_S_ADDR;
  const CONTRACT_D_ADDR = process.env.CONTRACT_D_ADDR;
  const VERIFIER_B_ADDR = process.env.VERIFIER_B_ADDR;

  if (!CONTRACT_S_ADDR || !CONTRACT_D_ADDR) {
    throw new Error("Missing contract addresses in .env. Run: npm run deploy:testnet");
  }

  const sessionId = Math.floor(Date.now() / 1000);
  
  // Setup providers
  const sepoliaProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const amoyProvider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  const sepoliaSigner = new ethers.Wallet(PRIVATE_KEY, sepoliaProvider);
  const amoySigner = new ethers.Wallet(PRIVATE_KEY, amoyProvider);

  console.log(`📋 Session ID: ${sessionId}`);
  console.log(`👛 Operator: ${sepoliaSigner.address}\n`);

  // ══════════════════════════════════════════════════════════════════
  // STEP 1: REQUEST RANDOMNESS
  // ══════════════════════════════════════════════════════════════════
  console.log("═".repeat(65));
  console.log("│ STEP 1: Request Randomness from ContractS (Sepolia)          │");
  console.log("═".repeat(65));
  
  const ContractS_ABI = [
    "function RequestRandomness(uint256 _sessionId) external",
    "function SubmitCommitment(bytes32 _commitment) external payable"
  ];
  
  const contractS = new ethers.Contract(CONTRACT_S_ADDR, ContractS_ABI, sepoliaSigner);

  const tx1 = await contractS.RequestRandomness(sessionId);
  await tx1.wait();
  console.log(`✅ RandomnessRequested event emitted`);
  console.log(`   Tx: ${tx1.hash}\n`);

  // ══════════════════════════════════════════════════════════════════
  // STEP 2: MPC DISTRIBUTED SEED GENERATION
  // ══════════════════════════════════════════════════════════════════
  console.log("═".repeat(65));
  console.log("│ STEP 2: MPC Distributed Seed Generation (3-of-5 Threshold)   │");
  console.log("═".repeat(65));
  
  const N_NODES = 5;
  const THRESHOLD = 3;

  // Create MPC nodes with deterministic keys (for reproducibility)
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

  // MPC Protocol
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
  // STEP 3: PIETRZAK VDF COMPUTATION
  // ══════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("│ STEP 3: Pietrzak VDF - Verifiable Delay Function             │");
  console.log("═".repeat(65));

  // VDF with T = 2^13 = 8192 squarings
  const T = 8192;
  const vdf = new PietrzakVDF(N_DEMO, T);
  
  console.log(`\n⚙️  VDF Configuration:`);
  console.log(`   T (squarings):  ${T} (2^${Math.log2(T)})`);
  console.log(`   Modulus bits:   ${N_DEMO.toString(2).length}`);

  // Compute VDF
  const vdfInput = BigInt(commitment) % N_DEMO;
  console.log(`\n🔄 Computing y = x^(2^${T}) mod N...`);
  
  const evalStart = Date.now();
  const vdfOutput = vdf.eval(vdfInput);
  const evalTime = Date.now() - evalStart;
  
  // Generate proof
  console.log(`\n📝 Generating Pietrzak proof...`);
  const proofStart = Date.now();
  const vdfProof = vdf.prove(vdfInput, vdfOutput);
  const proofTime = Date.now() - proofStart;
  
  // Verify proof
  console.log(`\n🔍 Verifying proof...`);
  const verifyStart = Date.now();
  const vdfValid = vdf.verify(vdfInput, vdfOutput, vdfProof);
  const verifyTime = Date.now() - verifyStart;
  
  console.log(`\n📊 VDF Result:`);
  console.log(`   Output (Y):     0x${vdfOutput.toString(16).slice(0, 32)}...`);
  console.log(`   Proof size:     ${vdfProof.length} elements`);
  console.log(`   Eval time:      ${evalTime}ms`);
  console.log(`   Proof time:     ${proofTime}ms`);
  console.log(`   Verify time:    ${verifyTime}ms`);
  console.log(`   Valid:          ${vdfValid ? '✅ YES' : '❌ NO'}`);

  // Convert to bytes32 for blockchain
  const vdfOutputBytes32 = ethers.zeroPadValue(
    '0x' + vdfOutput.toString(16).slice(0, 64), 
    32
  );
  const vdfProofHash = ethers.keccak256(
    ethers.toUtf8Bytes(vdfProof.map(p => p.toString(16)).join(','))
  );

  // ══════════════════════════════════════════════════════════════════
  // STEP 4: SUBMIT COMMITMENT VIA AXELAR
  // ══════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(65));
  console.log("│ STEP 4: Submit Commitment via Axelar Gateway                 │");
  console.log("═".repeat(65));
  
  console.log(`\n📤 Sending to Axelar Gateway...`);
  console.log(`   From: Ethereum Sepolia`);
  console.log(`   To:   Polygon Sepolia (Amoy)`);
  
  try {
    const tx2 = await contractS.SubmitCommitment(commitment, {
      value: ethers.parseEther("0.01"),
      gasLimit: 500000
    });
    console.log(`   Tx: ${tx2.hash}`);
    const receipt = await tx2.wait();
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   ✅ Message sent to Axelar Gateway\n`);
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 5: WAIT FOR AXELAR RELAY
  // ══════════════════════════════════════════════════════════════════
  console.log("═".repeat(65));
  console.log("│ STEP 5: Waiting for Axelar Relay (~2-5 minutes)              │");
  console.log("═".repeat(65));
  console.log(`\n📡 Monitor: https://testnet.axelarscan.io/gmp/search\n`);
  
  const ContractD_ABI = [
    "function commitments(uint256) view returns (bytes32)",
    "function vdfOutputs(uint256) view returns (bytes32)",
    "function submitVDFProof(uint256, bytes32, bytes32) external",
    "function submitSeed(uint256, bytes32) external",
    "function storeCommitment(uint256, bytes32) external"
  ];
  
  const contractD = new ethers.Contract(CONTRACT_D_ADDR, ContractD_ABI, amoySigner);

  let relaySuccess = false;
  for (let i = 1; i <= 6; i++) {
    const stored = await contractD.commitments(sessionId);
    if (stored !== ethers.ZeroHash) {
      console.log(`✅ Commitment received on Amoy!`);
      console.log(`   Stored: ${stored}\n`);
      relaySuccess = true;
      break;
    }
    process.stdout.write(`   Attempt ${i}/6... waiting 10s\r`);
    await new Promise(r => setTimeout(r, 10000));
  }
  console.log();

  if (!relaySuccess) {
    console.log("⚠️  Timeout - message may still be in transit");
    console.log("   📤 Submitting commitment directly to ContractD...");
    
    // Fallback: submit commitment directly
    try {
      const directTx = await contractD.storeCommitment(sessionId, commitment, {
        gasLimit: 100000
      });
      await directTx.wait();
      console.log(`   ✅ Commitment stored directly! Tx: ${directTx.hash}\n`);
    } catch (error) {
      console.error(`   ❌ Failed to store commitment:`, error.message, "\n");
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 6: SUBMIT VDF PROOF
  // ══════════════════════════════════════════════════════════════════
  console.log("═".repeat(65));
  console.log("│ STEP 6: Submit VDF Proof to ContractD (Amoy)                 │");
  console.log("═".repeat(65));
  
  console.log(`\n📤 Submitting VDF output and proof hash...`);
  console.log(`   VDF Output: ${vdfOutputBytes32.slice(0, 34)}...`);
  console.log(`   Proof Hash: ${vdfProofHash.slice(0, 34)}...`);

  try {
    const tx3 = await contractD.submitVDFProof(
      sessionId, 
      vdfOutputBytes32, 
      vdfProofHash,
      { gasLimit: 200000 }
    );
    await tx3.wait();
    console.log(`   ✅ VDF proof submitted! Tx: ${tx3.hash}\n`);
  } catch (error) {
    console.error(`   ❌ Error:`, error.message, "\n");
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 7: MPC THRESHOLD RECONSTRUCTION & SUBMIT SEED
  // ══════════════════════════════════════════════════════════════════
  console.log("═".repeat(65));
  console.log("│ STEP 7: MPC Threshold Reconstruction (3-of-5)                │");
  console.log("═".repeat(65));
  
  // Simulate: only nodes 1, 2, 4 are available
  const availableNodes = [1, 2, 4];
  console.log(`\n🔓 Reconstructing seed with nodes: ${availableNodes.join(', ')}`);
  
  const reconstructed = coordinator.reconstructSeed(availableNodes);
  const reconstructedHex = ethers.toBeHex(reconstructed, 32);
  
  console.log(`   Original:      ${seedHex.slice(0, 34)}...`);
  console.log(`   Reconstructed: ${reconstructedHex.slice(0, 34)}...`);
  console.log(`   Match:         ${reconstructed === combinedSeed ? '✅ YES' : '❌ NO'}`);

  console.log(`\n📤 Submitting seed to ContractD...`);
  
  try {
    const tx4 = await contractD.submitSeed(sessionId, reconstructedHex, {
      gasLimit: 200000
    });
    await tx4.wait();
    console.log(`   ✅ Seed submitted! Tx: ${tx4.hash}\n`);
  } catch (error) {
    console.error(`   ❌ Error:`, error.message, "\n");
  }

  // ══════════════════════════════════════════════════════════════════
  // STEP 8: VERIFY FINAL RANDOMNESS
  // ══════════════════════════════════════════════════════════════════
  console.log("═".repeat(65));
  console.log("│ STEP 8: Verify Final Randomness                              │");
  console.log("═".repeat(65));

  const Verifier_ABI = ["function randomness(uint256) view returns (bytes32)"];
  const verifier = new ethers.Contract(VERIFIER_B_ADDR, Verifier_ABI, amoyProvider);

  const finalRandomness = await verifier.randomness(sessionId);
  const expectedRandomness = ethers.keccak256(
    ethers.concat([vdfOutputBytes32, reconstructedHex])
  );

  // ══════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ══════════════════════════════════════════════════════════════════
  console.log("\n" + "╔".padEnd(64, "═") + "╗");
  console.log("║" + "  🎉 DRNG WORKFLOW COMPLETE".padEnd(63) + "║");
  console.log("╚".padEnd(64, "═") + "╝");

  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│ CRYPTOGRAPHIC COMPONENTS                                        │
├─────────────────────────────────────────────────────────────────┤
│ MPC:                                                            │
│   • Nodes:           ${N_NODES}                                           │
│   • Threshold:       ${THRESHOLD}-of-${N_NODES}                                       │
│   • Secret Sharing:  Shamir's scheme                            │
│   • Reconstruction:  Nodes [${availableNodes.join(', ')}]                             │
├─────────────────────────────────────────────────────────────────┤
│ VDF (Pietrzak):                                                 │
│   • Squarings (T):   ${T} (2^${Math.log2(T)})                               │
│   • Proof size:      ${vdfProof.length} group elements                           │
│   • Eval time:       ${evalTime}ms (sequential)                         │
│   • Verify time:     ${verifyTime}ms (O(log T))                          │
├─────────────────────────────────────────────────────────────────┤
│ Cross-Chain (Axelar):                                           │
│   • Source:          Ethereum Sepolia                           │
│   • Destination:     Polygon Amoy                               │
│   • Protocol:        GMP (General Message Passing)              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ RESULTS                                                         │
├─────────────────────────────────────────────────────────────────┤
│ Session ID:       ${sessionId}                                  │
│ Commitment:       ${commitment.slice(0, 42)}...       │
│ VDF Output:       ${vdfOutputBytes32.slice(0, 42)}...       │
│ Final Randomness: ${finalRandomness.slice(0, 42)}...       │
│ Expected:         ${expectedRandomness.slice(0, 42)}...       │
│ Match:            ${finalRandomness === expectedRandomness ? '✅ YES' : '❌ NO'}                                           │
└─────────────────────────────────────────────────────────────────┘
`);

  // Save session data
  const sessionData = {
    sessionId,
    mpc: {
      nodes: N_NODES,
      threshold: THRESHOLD,
      seed: seedHex,
      commitment
    },
    vdf: {
      T,
      output: vdfOutputBytes32,
      proofHash: vdfProofHash,
      evalTime,
      verifyTime,
      valid: vdfValid
    },
    blockchain: {
      contractS: CONTRACT_S_ADDR,
      contractD: CONTRACT_D_ADDR,
      verifier: VERIFIER_B_ADDR,
      finalRandomness
    },
    timestamp: Date.now()
  };
  
  fs.writeFileSync(
    `./drng_session_${sessionId}.json`, 
    JSON.stringify(sessionData, null, 2)
  );
  console.log(`📁 Session saved: ./drng_session_${sessionId}.json\n`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
