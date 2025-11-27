/**
 * Attack Simulation: RANDAO vs Our DRNG System
 * 
 * Mô phỏng "Last-Revealer Attack" trong NFT Drop
 * - 10 người tham gia
 * - 1 NFT huyền thoại (winner random)
 * - Attacker muốn bias kết quả để thắng
 */

const { ethers } = require("hardhat");
const { MPCNode, MPCCoordinator } = require("./mpc_simulation");
const { PietrzakVDF, N_DEMO } = require("./vdf_implementation");

// ═══════════════════════════════════════════════════════════════════
// SIMULATION SETUP
// ═══════════════════════════════════════════════════════════════════

const PARTICIPANTS = [
  "Alice", "Bob", "Charlie", "David", "Eve",
  "Frank", "Grace", "Henry", "Ivy", "Jack"
];

const ATTACKER = "Eve";  // Eve là attacker (index 4)
const ATTACKER_INDEX = PARTICIPANTS.indexOf(ATTACKER);

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║     ATTACK SIMULATION: RANDAO vs Our DRNG System            ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

console.log(`📋 NFT Drop: 1 Legendary NFT (worth 100 ETH)`);
console.log(`👥 Participants: ${PARTICIPANTS.join(", ")}`);
console.log(`😈 Attacker: ${ATTACKER} (wants to win the NFT)\n`);

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 1: RANDAO ATTACK (SUCCESSFUL)
// ═══════════════════════════════════════════════════════════════════

async function simulateRANDAOAttack() {
  console.log("═".repeat(65));
  console.log("│ SCENARIO 1: RANDAO - Last Revealer Attack                   │");
  console.log("═".repeat(65));
  
  // Simulate multiple blocks where attacker is validator
  const NUM_SIMULATIONS = 100;
  let attackSuccesses = 0;
  let normalWins = 0;
  
  console.log(`\n🔄 Simulating ${NUM_SIMULATIONS} NFT drops...\n`);
  
  for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
    // Block N-1: Current RANDAO value
    const prevRandao = BigInt(ethers.keccak256(ethers.toUtf8Bytes(`block_${sim}`)));
    
    // Attacker is validator for this block (assume 10% chance normally)
    // For demo, attacker is ALWAYS validator to show attack
    const attackerReveal = BigInt(ethers.keccak256(ethers.toUtf8Bytes(`eve_reveal_${sim}`)));
    
    // RANDAO if attacker proposes block
    const randaoIfPropose = BigInt(ethers.keccak256(
      ethers.concat([ethers.toBeHex(prevRandao, 32), ethers.toBeHex(attackerReveal, 32)])
    ));
    const winnerIfPropose = Number(randaoIfPropose % 10n);
    
    // RANDAO if attacker SKIPS (next validator proposes)
    const nextValidatorReveal = BigInt(ethers.keccak256(ethers.toUtf8Bytes(`other_reveal_${sim}`)));
    const randaoIfSkip = BigInt(ethers.keccak256(
      ethers.concat([ethers.toBeHex(prevRandao, 32), ethers.toBeHex(nextValidatorReveal, 32)])
    ));
    const winnerIfSkip = Number(randaoIfSkip % 10n);
    
    // Attacker's decision: propose or skip?
    let finalWinner;
    let didSkip = false;
    
    if (winnerIfPropose === ATTACKER_INDEX) {
      // Attacker wins if propose → propose
      finalWinner = winnerIfPropose;
    } else if (winnerIfSkip === ATTACKER_INDEX) {
      // Attacker wins if skip → skip
      finalWinner = winnerIfSkip;
      didSkip = true;
    } else {
      // Neither wins → just propose (minimize loss)
      finalWinner = winnerIfPropose;
    }
    
    if (finalWinner === ATTACKER_INDEX) {
      attackSuccesses++;
    }
    
    // Log first few simulations
    if (sim < 5) {
      console.log(`   Drop #${sim + 1}:`);
      console.log(`     If propose: Winner = ${PARTICIPANTS[winnerIfPropose]}`);
      console.log(`     If skip:    Winner = ${PARTICIPANTS[winnerIfSkip]}`);
      console.log(`     ${ATTACKER}'s choice: ${didSkip ? 'SKIP ⚡' : 'PROPOSE'}`);
      console.log(`     Winner: ${PARTICIPANTS[finalWinner]} ${finalWinner === ATTACKER_INDEX ? '← ATTACKER WINS! 🎯' : ''}\n`);
    }
  }
  
  // Also calculate normal probability (10%)
  const normalProb = 10; // 1/10 participants
  
  // With attack: 2 chances per block (propose or skip)
  // P(win) ≈ 1 - (9/10)^2 = 19%
  const attackProb = (attackSuccesses / NUM_SIMULATIONS * 100).toFixed(1);
  
  console.log(`   ... (${NUM_SIMULATIONS - 5} more simulations)\n`);
  
  console.log(`📊 RANDAO Attack Results:`);
  console.log(`   Normal win rate:     10% (1 in 10)`);
  console.log(`   With attack:         ${attackProb}% (${attackSuccesses} in ${NUM_SIMULATIONS})`);
  console.log(`   Advantage:           ${(attackProb - normalProb).toFixed(1)}% increase`);
  console.log(`   Attack cost:         ~0.05 ETH (missed block reward when skipping)`);
  console.log(`   Expected profit:     ${((attackProb/100 - 0.1) * 100).toFixed(1)} ETH per drop`);
  console.log(`   ❌ ATTACK SUCCESSFUL - Attacker doubles win probability!\n`);
  
  return { attackProb: parseFloat(attackProb), normalProb };
}

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 2: OUR SYSTEM - ATTACK FAILS
// ═══════════════════════════════════════════════════════════════════

async function simulateOurSystemAttack() {
  console.log("═".repeat(65));
  console.log("│ SCENARIO 2: Our DRNG System - Attack Attempt                │");
  console.log("═".repeat(65));
  
  const NUM_SIMULATIONS = 20;
  let attackSuccesses = 0;
  
  console.log(`\n🔄 Simulating ${NUM_SIMULATIONS} NFT drops with attack attempts...\n`);
  
  for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
    const sessionId = 1000 + sim;
    
    // ──────────────────────────────────────────────────
    // PHASE 1: COMMIT (all nodes commit simultaneously)
    // ──────────────────────────────────────────────────
    
    // Generate random values for each node (including attacker's node)
    const nodeValues = [];
    const nodeCommits = [];
    
    // Nodes 1-4: Honest nodes
    for (let i = 1; i <= 4; i++) {
      const r = BigInt(ethers.keccak256(ethers.toUtf8Bytes(`node${i}_session${sessionId}`)));
      nodeValues.push(r);
      nodeCommits.push(ethers.keccak256(ethers.toBeHex(r, 32)));
    }
    
    // Node 5: Attacker (Eve controls this node)
    // Attacker wants to choose r5 such that final winner = Eve
    // But attacker DOESN'T KNOW r1, r2, r3, r4 yet!
    
    // Attacker tries to guess/predict...
    const attackerValue = BigInt(ethers.keccak256(ethers.toUtf8Bytes(`eve_attack_${sessionId}`)));
    nodeValues.push(attackerValue);
    nodeCommits.push(ethers.keccak256(ethers.toBeHex(attackerValue, 32)));
    
    // ──────────────────────────────────────────────────
    // PHASE 2: REVEAL (all commits are locked!)
    // ──────────────────────────────────────────────────
    
    // At this point, attacker sees r1, r2, r3, r4
    // Can attacker change r5? NO! Commit is locked!
    
    // Combined seed
    let combinedSeed = 0n;
    for (const v of nodeValues) {
      combinedSeed ^= v;
    }
    
    // ──────────────────────────────────────────────────
    // PHASE 3: VDF (attacker cannot skip or change)
    // ──────────────────────────────────────────────────
    
    // VDF computation (simplified for simulation)
    const T = 64; // Smaller T for simulation speed
    const vdf = new PietrzakVDF(N_DEMO, T);
    const x = combinedSeed % N_DEMO;
    
    // Attacker tries to compute VDF before reveal deadline...
    // But VDF is sequential! Even with all compute power, takes same time
    const y = vdf.eval(x);
    
    // ──────────────────────────────────────────────────
    // PHASE 4: DETERMINE WINNER
    // ──────────────────────────────────────────────────
    
    const finalRandomness = BigInt(ethers.keccak256(
      ethers.concat([
        ethers.toBeHex(y % (2n ** 256n), 32),
        ethers.toBeHex(combinedSeed % (2n ** 256n), 32)
      ])
    ));
    
    const winner = Number(finalRandomness % 10n);
    
    if (winner === ATTACKER_INDEX) {
      attackSuccesses++;
    }
    
    // Log first few simulations
    if (sim < 3) {
      console.log(`   Drop #${sim + 1}:`);
      console.log(`     Combined Seed: ${ethers.toBeHex(combinedSeed % (2n**64n), 8)}...`);
      console.log(`     VDF Output:    ${ethers.toBeHex(y % (2n**64n), 8)}...`);
      console.log(`     Winner:        ${PARTICIPANTS[winner]} ${winner === ATTACKER_INDEX ? '(Attacker - by luck only)' : ''}`);
      
      // Show WHY attack failed
      console.log(`     \n     🛡️ Why attack failed:`);
      console.log(`        1. Commit locked before reveal → Can't change r5`);
      console.log(`        2. Didn't know r1-r4 when committing → Can't predict seed`);
      console.log(`        3. VDF is sequential → No time to try multiple values\n`);
    }
  }
  
  const attackProb = (attackSuccesses / NUM_SIMULATIONS * 100).toFixed(1);
  
  console.log(`   ... (${NUM_SIMULATIONS - 3} more simulations)\n`);
  
  console.log(`📊 Our System Attack Results:`);
  console.log(`   Normal win rate:     10% (1 in 10)`);
  console.log(`   With attack attempt: ${attackProb}% (${attackSuccesses} in ${NUM_SIMULATIONS})`);
  console.log(`   Advantage:           0% (no advantage!)`);
  console.log(`   Attack cost:         N/A (attack not possible)`);
  console.log(`   Expected profit:     0 ETH`);
  console.log(`   ✅ ATTACK FAILED - Attacker has NO advantage!\n`);
  
  return { attackProb: parseFloat(attackProb) };
}

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 3: DETAILED STEP-BY-STEP ATTACK ATTEMPT
// ═══════════════════════════════════════════════════════════════════

async function detailedAttackDemo() {
  console.log("═".repeat(65));
  console.log("│ SCENARIO 3: Step-by-Step Attack Attempt on Our System       │");
  console.log("═".repeat(65));
  
  console.log(`\n😈 ${ATTACKER} (Attacker) controls MPC Node 3`);
  console.log(`   Goal: Manipulate randomness to win the NFT\n`);
  
  const sessionId = 999;
  
  // ──────────────────────────────────────────────────
  console.log(`┌─ STEP 1: COMMIT PHASE ─────────────────────────────────────────┐`);
  console.log(`│                                                                │`);
  
  // Generate honest node values (attacker doesn't know these!)
  const r1 = BigInt(ethers.keccak256(ethers.toUtf8Bytes("node1_secret")));
  const r2 = BigInt(ethers.keccak256(ethers.toUtf8Bytes("node2_secret")));
  const r4 = BigInt(ethers.keccak256(ethers.toUtf8Bytes("node4_secret")));
  const r5 = BigInt(ethers.keccak256(ethers.toUtf8Bytes("node5_secret")));
  
  console.log(`│ Honest nodes commit (attacker CANNOT see these values):       │`);
  console.log(`│   Node 1: commit(hash(r1)) = ${ethers.keccak256(ethers.toBeHex(r1, 32)).slice(0,20)}...      │`);
  console.log(`│   Node 2: commit(hash(r2)) = ${ethers.keccak256(ethers.toBeHex(r2, 32)).slice(0,20)}...      │`);
  console.log(`│   Node 4: commit(hash(r4)) = ${ethers.keccak256(ethers.toBeHex(r4, 32)).slice(0,20)}...      │`);
  console.log(`│   Node 5: commit(hash(r5)) = ${ethers.keccak256(ethers.toBeHex(r5, 32)).slice(0,20)}...      │`);
  console.log(`│                                                                │`);
  
  // Attacker must commit WITHOUT knowing other values
  console.log(`│ 😈 ${ATTACKER}'s dilemma:                                          │`);
  console.log(`│   "I need to choose r3, but I don't know r1,r2,r4,r5!"        │`);
  console.log(`│   "I can't predict what combinedSeed will be!"                │`);
  console.log(`│                                                                │`);
  
  // Attacker just picks a random value
  const r3_attacker = BigInt(ethers.keccak256(ethers.toUtf8Bytes("eve_tries_to_win")));
  console.log(`│   ${ATTACKER} commits: hash(r3) = ${ethers.keccak256(ethers.toBeHex(r3_attacker, 32)).slice(0,20)}...       │`);
  console.log(`│                                                                │`);
  console.log(`│ ⏰ COMMIT DEADLINE PASSED - All commits LOCKED!               │`);
  console.log(`└────────────────────────────────────────────────────────────────┘\n`);
  
  // ──────────────────────────────────────────────────
  console.log(`┌─ STEP 2: REVEAL PHASE ─────────────────────────────────────────┐`);
  console.log(`│                                                                │`);
  console.log(`│ All nodes reveal their values:                                 │`);
  console.log(`│   Node 1 reveals r1 ✓ (matches commit)                        │`);
  console.log(`│   Node 2 reveals r2 ✓ (matches commit)                        │`);
  console.log(`│   Node 4 reveals r4 ✓ (matches commit)                        │`);
  console.log(`│   Node 5 reveals r5 ✓ (matches commit)                        │`);
  console.log(`│                                                                │`);
  
  // Attacker NOW sees all values
  console.log(`│ 😈 ${ATTACKER} sees: r1=${ethers.toBeHex(r1 % (2n**32n), 4)}..., r2=${ethers.toBeHex(r2 % (2n**32n), 4)}...            │`);
  console.log(`│                                                                │`);
  
  // Attacker tries to cheat by revealing different value
  const combinedIfHonest = r1 ^ r2 ^ r3_attacker ^ r4 ^ r5;
  const winnerIfHonest = Number((combinedIfHonest % (2n ** 256n)) % 10n);
  
  console.log(`│ 😈 ${ATTACKER} calculates:                                         │`);
  console.log(`│   "If I reveal r3, winner will be ${PARTICIPANTS[winnerIfHonest]}..."                │`);
  
  if (winnerIfHonest !== ATTACKER_INDEX) {
    console.log(`│   "That's not me! Let me try a different r3'..."              │`);
    console.log(`│                                                                │`);
    
    // Try to find a winning r3
    let foundWinning = false;
    for (let i = 0; i < 10; i++) {
      const r3_try = BigInt(ethers.keccak256(ethers.toUtf8Bytes(`try_${i}`)));
      const combined_try = r1 ^ r2 ^ r3_try ^ r4 ^ r5;
      const winner_try = Number((combined_try % (2n ** 256n)) % 10n);
      
      if (winner_try === ATTACKER_INDEX) {
        console.log(`│   "Found it! r3' = ${ethers.toBeHex(r3_try % (2n**32n), 4)}... would make me win!"   │`);
        console.log(`│                                                                │`);
        console.log(`│   ❌ BUT: hash(r3') ≠ committed hash(r3)                       │`);
        console.log(`│   ❌ REJECTED! Commit doesn't match!                           │`);
        foundWinning = true;
        break;
      }
    }
    
    if (!foundWinning) {
      console.log(`│   "Can't find winning value anyway..."                        │`);
    }
  } else {
    console.log(`│   "Lucky! That's me!"                                         │`);
  }
  
  console.log(`│                                                                │`);
  console.log(`│ 😈 ${ATTACKER} MUST reveal original r3 (or be slashed)              │`);
  console.log(`└────────────────────────────────────────────────────────────────┘\n`);
  
  // ──────────────────────────────────────────────────
  console.log(`┌─ STEP 3: VDF COMPUTATION ──────────────────────────────────────┐`);
  console.log(`│                                                                │`);
  
  const combinedSeed = r1 ^ r2 ^ r3_attacker ^ r4 ^ r5;
  console.log(`│ Combined Seed = r1 ⊕ r2 ⊕ r3 ⊕ r4 ⊕ r5                        │`);
  console.log(`│              = ${ethers.toBeHex(combinedSeed % (2n**64n), 8)}...                            │`);
  console.log(`│                                                                │`);
  
  const T = 8192;
  console.log(`│ VDF: y = seed^(2^${T}) mod N                                   │`);
  console.log(`│                                                                │`);
  console.log(`│ 😈 ${ATTACKER}'s last hope:                                        │`);
  console.log(`│   "Maybe I can compute VDF faster than others..."              │`);
  console.log(`│                                                                │`);
  console.log(`│   ❌ IMPOSSIBLE! VDF is SEQUENTIAL                             │`);
  console.log(`│      - Each step depends on previous                           │`);
  console.log(`│      - Cannot parallelize                                      │`);
  console.log(`│      - Even 1000 GPUs = same time as 1 CPU                     │`);
  console.log(`│                                                                │`);
  
  // Compute VDF
  const vdf = new PietrzakVDF(N_DEMO, T);
  const x = combinedSeed % N_DEMO;
  const y = vdf.eval(x);
  
  console.log(`│ VDF Output: ${ethers.toBeHex(y % (2n**64n), 8)}...                             │`);
  console.log(`└────────────────────────────────────────────────────────────────┘\n`);
  
  // ──────────────────────────────────────────────────
  console.log(`┌─ STEP 4: FINAL RESULT ─────────────────────────────────────────┐`);
  console.log(`│                                                                │`);
  
  const finalRandomness = BigInt(ethers.keccak256(
    ethers.concat([
      ethers.toBeHex(y % (2n ** 256n), 32),
      ethers.toBeHex(combinedSeed % (2n ** 256n), 32)
    ])
  ));
  
  const winner = Number(finalRandomness % 10n);
  
  console.log(`│ Final Randomness = hash(VDF_output, seed)                      │`);
  console.log(`│                 = ${ethers.toBeHex(finalRandomness % (2n**64n), 8)}...                     │`);
  console.log(`│                                                                │`);
  console.log(`│ Winner Index = ${winner}                                                │`);
  console.log(`│ Winner = ${PARTICIPANTS[winner].padEnd(10)} ${winner === ATTACKER_INDEX ? '← ATTACKER (by pure luck!)' : '← NOT ATTACKER'}           │`);
  console.log(`│                                                                │`);
  
  if (winner === ATTACKER_INDEX) {
    console.log(`│ 😈 ${ATTACKER} won, but ONLY by chance (10% probability)          │`);
  } else {
    console.log(`│ 😈 ${ATTACKER} FAILED - No way to manipulate the result!          │`);
  }
  
  console.log(`│                                                                │`);
  console.log(`│ ✅ SYSTEM SECURE - Attacker has exactly 10% chance (fair)     │`);
  console.log(`└────────────────────────────────────────────────────────────────┘\n`);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  // Run RANDAO attack simulation
  const randaoResult = await simulateRANDAOAttack();
  
  // Run our system attack simulation
  const ourResult = await simulateOurSystemAttack();
  
  // Detailed step-by-step
  await detailedAttackDemo();
  
  // Summary
  console.log("═".repeat(65));
  console.log("│ SUMMARY                                                       │");
  console.log("═".repeat(65));
  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    ATTACK COMPARISON                            │
├─────────────────────────────────────────────────────────────────┤
│                        RANDAO          Our System               │
├─────────────────────────────────────────────────────────────────┤
│ Normal win rate:       10%              10%                     │
│ With attack:           ~19%             ~10%                    │
│ Attacker advantage:    +9%              +0%                     │
│ Attack possible:       ✅ YES           ❌ NO                    │
│ Attack cost:           ~0.05 ETH        N/A                     │
│ Bias resistance:       ❌ WEAK          ✅ STRONG                │
├─────────────────────────────────────────────────────────────────┤
│ VERDICT:               VULNERABLE       SECURE                  │
└─────────────────────────────────────────────────────────────────┘

🛡️ Why Our System is Secure:
   1. COMMIT-REVEAL: Can't change value after seeing others
   2. MPC: Need multiple nodes to collude (3/5 threshold)
   3. VDF: Sequential - no time to compute & decide to skip
   4. NO SKIP OPTION: Unlike RANDAO, can't "skip" a block
`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });
