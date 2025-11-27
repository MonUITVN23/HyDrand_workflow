/**
 * MPC (Multi-Party Computation) Simulation for DRNG
 * 
 * This implements:
 * 1. Shamir's Secret Sharing - Split seed into shares
 * 2. Threshold scheme (t-of-n) - Require t nodes to reconstruct
 * 3. Distributed randomness - Each node contributes entropy
 * 4. Commitment scheme - Commit before reveal
 * 
 * Architecture:
 * ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
 * │ Node 1  │  │ Node 2  │  │ Node 3  │  │ Node 4  │  │ Node 5  │
 * │ share_1 │  │ share_2 │  │ share_3 │  │ share_4 │  │ share_5 │
 * └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
 *      │            │            │            │            │
 *      └────────────┴─────┬──────┴────────────┴────────────┘
 *                         │
 *                   ┌─────▼─────┐
 *                   │ Threshold │  (3-of-5 required)
 *                   │  Combine  │
 *                   └─────┬─────┘
 *                         │
 *                   ┌─────▼─────┐
 *                   │   Seed    │
 *                   │ Revealed  │
 *                   └───────────┘
 */

const { ethers } = require("hardhat");
const crypto = require("crypto");

// ============================================================
// FINITE FIELD ARITHMETIC (mod prime)
// ============================================================

// Using a large prime for finite field operations
const PRIME = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

class FiniteField {
  static mod(a, p = PRIME) {
    return ((a % p) + p) % p;
  }

  static add(a, b, p = PRIME) {
    return this.mod(a + b, p);
  }

  static sub(a, b, p = PRIME) {
    return this.mod(a - b, p);
  }

  static mul(a, b, p = PRIME) {
    return this.mod(a * b, p);
  }

  static pow(base, exp, p = PRIME) {
    let result = 1n;
    base = this.mod(base, p);
    while (exp > 0n) {
      if (exp % 2n === 1n) {
        result = this.mul(result, base, p);
      }
      exp = exp / 2n;
      base = this.mul(base, base, p);
    }
    return result;
  }

  // Modular multiplicative inverse using Fermat's little theorem
  static inv(a, p = PRIME) {
    return this.pow(a, p - 2n, p);
  }

  static div(a, b, p = PRIME) {
    return this.mul(a, this.inv(b, p), p);
  }
}

// ============================================================
// SHAMIR'S SECRET SHARING
// ============================================================

class ShamirSecretSharing {
  /**
   * Split a secret into n shares, requiring t shares to reconstruct
   * @param {BigInt} secret - The secret to split
   * @param {number} n - Total number of shares
   * @param {number} t - Threshold (minimum shares needed)
   * @returns {Array} Array of {x, y} shares
   */
  static split(secret, n, t) {
    // Generate random polynomial coefficients
    // f(x) = secret + a1*x + a2*x^2 + ... + a(t-1)*x^(t-1)
    const coefficients = [secret];
    
    for (let i = 1; i < t; i++) {
      const randomBytes = crypto.randomBytes(32);
      const coef = BigInt("0x" + randomBytes.toString("hex")) % PRIME;
      coefficients.push(coef);
    }

    // Generate shares by evaluating polynomial at x = 1, 2, 3, ..., n
    const shares = [];
    for (let x = 1; x <= n; x++) {
      const xBig = BigInt(x);
      let y = 0n;
      
      for (let i = 0; i < coefficients.length; i++) {
        const term = FiniteField.mul(
          coefficients[i],
          FiniteField.pow(xBig, BigInt(i))
        );
        y = FiniteField.add(y, term);
      }
      
      shares.push({ x: xBig, y });
    }

    return shares;
  }

  /**
   * Reconstruct secret from t or more shares using Lagrange interpolation
   * @param {Array} shares - Array of {x, y} shares
   * @returns {BigInt} The reconstructed secret
   */
  static reconstruct(shares) {
    let secret = 0n;

    for (let i = 0; i < shares.length; i++) {
      let numerator = 1n;
      let denominator = 1n;

      for (let j = 0; j < shares.length; j++) {
        if (i !== j) {
          // Lagrange basis polynomial
          numerator = FiniteField.mul(numerator, FiniteField.sub(0n, shares[j].x));
          denominator = FiniteField.mul(denominator, FiniteField.sub(shares[i].x, shares[j].x));
        }
      }

      const lagrangeCoef = FiniteField.div(numerator, denominator);
      const term = FiniteField.mul(shares[i].y, lagrangeCoef);
      secret = FiniteField.add(secret, term);
    }

    return secret;
  }
}

// ============================================================
// MPC NODE
// ============================================================

class MPCNode {
  constructor(id, privateKey) {
    this.id = id;
    this.privateKey = privateKey;
    this.wallet = new ethers.Wallet(privateKey);
    this.share = null;
    this.localRandomness = null;
    this.commitment = null;
  }

  /**
   * Generate local randomness contribution
   */
  generateLocalRandomness() {
    this.localRandomness = crypto.randomBytes(32);
    // Commit to local randomness (hash it)
    this.commitment = ethers.keccak256(this.localRandomness);
    return this.commitment;
  }

  /**
   * Reveal local randomness (after all commitments received)
   */
  revealRandomness() {
    return this.localRandomness;
  }

  /**
   * Store a share of the combined seed
   */
  storeShare(share) {
    this.share = share;
  }

  /**
   * Sign a message with node's private key
   */
  async sign(message) {
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
    return await this.wallet.signMessage(ethers.getBytes(messageHash));
  }

  /**
   * Get share for reconstruction (if node agrees to participate)
   */
  getShare() {
    return this.share;
  }
}

// ============================================================
// MPC COORDINATOR
// ============================================================

class MPCCoordinator {
  constructor(nodes, threshold) {
    this.nodes = nodes;
    this.n = nodes.length;
    this.t = threshold;
    this.sessionId = null;
    this.commitments = new Map();
    this.reveals = new Map();
    this.combinedSeed = null;
  }

  /**
   * Phase 1: Collect commitments from all nodes
   */
  async collectCommitments(sessionId) {
    this.sessionId = sessionId;
    console.log(`\n📋 Session ${sessionId}: Collecting commitments from ${this.n} nodes...`);
    
    for (const node of this.nodes) {
      const commitment = node.generateLocalRandomness();
      this.commitments.set(node.id, commitment);
      console.log(`   Node ${node.id}: ${commitment.slice(0, 18)}...`);
    }
    
    return Array.from(this.commitments.values());
  }

  /**
   * Phase 2: Collect reveals and verify against commitments
   */
  async collectReveals() {
    console.log(`\n🔓 Collecting reveals and verifying...`);
    
    for (const node of this.nodes) {
      const reveal = node.revealRandomness();
      const expectedCommitment = this.commitments.get(node.id);
      const actualCommitment = ethers.keccak256(reveal);
      
      if (expectedCommitment !== actualCommitment) {
        throw new Error(`Node ${node.id} cheated! Commitment mismatch.`);
      }
      
      this.reveals.set(node.id, reveal);
      console.log(`   Node ${node.id}: Verified ✓`);
    }
    
    return true;
  }

  /**
   * Phase 3: Combine all randomness contributions into final seed
   */
  combineSeed() {
    console.log(`\n🔀 Combining randomness from all nodes...`);
    
    // XOR all randomness contributions
    let combined = Buffer.alloc(32, 0);
    
    for (const [nodeId, randomness] of this.reveals) {
      for (let i = 0; i < 32; i++) {
        combined[i] ^= randomness[i];
      }
    }
    
    this.combinedSeed = BigInt("0x" + combined.toString("hex"));
    console.log(`   Combined seed: 0x${this.combinedSeed.toString(16).slice(0, 16)}...`);
    
    return this.combinedSeed;
  }

  /**
   * Phase 4: Split seed into shares using Shamir's Secret Sharing
   */
  distributeSharesToNodes() {
    console.log(`\n🔐 Splitting seed into ${this.n} shares (threshold: ${this.t})...`);
    
    const shares = ShamirSecretSharing.split(this.combinedSeed, this.n, this.t);
    
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].storeShare(shares[i]);
      console.log(`   Node ${this.nodes[i].id}: Share stored`);
    }
    
    return shares;
  }

  /**
   * Phase 5: Reconstruct seed from threshold number of shares
   */
  reconstructSeed(participatingNodeIds) {
    console.log(`\n🔓 Reconstructing seed from ${participatingNodeIds.length} nodes...`);
    
    if (participatingNodeIds.length < this.t) {
      throw new Error(`Need at least ${this.t} nodes, got ${participatingNodeIds.length}`);
    }
    
    const shares = [];
    for (const nodeId of participatingNodeIds) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (node && node.getShare()) {
        shares.push(node.getShare());
        console.log(`   Node ${nodeId}: Share retrieved`);
      }
    }
    
    const reconstructed = ShamirSecretSharing.reconstruct(shares.slice(0, this.t));
    console.log(`   Reconstructed: 0x${reconstructed.toString(16).slice(0, 16)}...`);
    
    return reconstructed;
  }

  /**
   * Get the commitment hash of the combined seed
   */
  getCommitment() {
    const seedBytes = ethers.toBeHex(this.combinedSeed, 32);
    return ethers.keccak256(seedBytes);
  }
}

// ============================================================
// DEMO
// ============================================================

async function runMPCDemo() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           MPC (Multi-Party Computation) DRNG Demo            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Configuration
  const N_NODES = 5;      // Total nodes
  const THRESHOLD = 3;    // Minimum nodes needed to reconstruct

  console.log(`\n⚙️  Configuration: ${THRESHOLD}-of-${N_NODES} threshold scheme`);

  // Create MPC nodes (each with unique private key)
  console.log(`\n👥 Creating ${N_NODES} MPC nodes...`);
  const nodes = [];
  for (let i = 1; i <= N_NODES; i++) {
    // Generate deterministic keys for demo
    const privateKey = ethers.keccak256(ethers.toUtf8Bytes(`mpc_node_${i}_secret`));
    const node = new MPCNode(i, privateKey);
    nodes.push(node);
    console.log(`   Node ${i}: ${node.wallet.address.slice(0, 14)}...`);
  }

  // Create coordinator
  const coordinator = new MPCCoordinator(nodes, THRESHOLD);

  // Run MPC protocol
  const sessionId = Math.floor(Date.now() / 1000);

  // Phase 1: Commitments
  await coordinator.collectCommitments(sessionId);

  // Phase 2: Reveals
  await coordinator.collectReveals();

  // Phase 3: Combine
  const combinedSeed = coordinator.combineSeed();

  // Phase 4: Distribute shares
  coordinator.distributeSharesToNodes();

  // Get commitment for blockchain
  const commitment = coordinator.getCommitment();
  console.log(`\n📌 Commitment for blockchain: ${commitment}`);

  // ==================== SIMULATION OF NODE FAILURES ====================
  
  console.log("\n" + "═".repeat(60));
  console.log("🧪 Testing threshold reconstruction scenarios...");
  console.log("═".repeat(60));

  // Scenario 1: All 5 nodes participate (SUCCESS)
  console.log("\n📊 Scenario 1: All 5 nodes participate");
  const reconstructed1 = coordinator.reconstructSeed([1, 2, 3, 4, 5]);
  console.log(`   Match: ${reconstructed1 === combinedSeed ? "✅ YES" : "❌ NO"}`);

  // Scenario 2: Only 3 nodes participate (SUCCESS - meets threshold)
  console.log("\n📊 Scenario 2: Only 3 nodes participate (meets threshold)");
  const reconstructed2 = coordinator.reconstructSeed([1, 3, 5]);
  console.log(`   Match: ${reconstructed2 === combinedSeed ? "✅ YES" : "❌ NO"}`);

  // Scenario 3: Different 3 nodes (SUCCESS)
  console.log("\n📊 Scenario 3: Different 3 nodes participate");
  const reconstructed3 = coordinator.reconstructSeed([2, 4, 5]);
  console.log(`   Match: ${reconstructed3 === combinedSeed ? "✅ YES" : "❌ NO"}`);

  // Scenario 4: Only 2 nodes (FAIL - below threshold)
  console.log("\n📊 Scenario 4: Only 2 nodes participate (below threshold)");
  try {
    coordinator.reconstructSeed([1, 2]);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // ==================== FINAL OUTPUT ====================
  
  console.log("\n" + "═".repeat(60));
  console.log("📋 MPC DRNG Summary");
  console.log("═".repeat(60));
  console.log(`   Session ID:     ${sessionId}`);
  console.log(`   Nodes:          ${N_NODES}`);
  console.log(`   Threshold:      ${THRESHOLD}`);
  console.log(`   Combined Seed:  0x${combinedSeed.toString(16).slice(0, 32)}...`);
  console.log(`   Commitment:     ${commitment.slice(0, 34)}...`);
  console.log(`   Status:         ✅ Ready for blockchain submission`);

  return {
    sessionId,
    seed: ethers.toBeHex(combinedSeed, 32),
    commitment,
    nodes: N_NODES,
    threshold: THRESHOLD
  };
}

// Export for use in other scripts
module.exports = {
  MPCNode,
  MPCCoordinator,
  ShamirSecretSharing,
  FiniteField,
  runMPCDemo
};

// Run if executed directly
if (require.main === module) {
  runMPCDemo()
    .then(result => {
      console.log("\n✅ MPC Demo completed successfully!");
      process.exit(0);
    })
    .catch(error => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
}
