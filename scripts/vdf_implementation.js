/**
 * Pietrzak VDF - Correct Implementation
 * 
 * Based on: "Simple Verifiable Delay Functions" by Krzysztof Pietrzak (2018)
 * https://eprint.iacr.org/2018/627.pdf
 * 
 * Key insight: 
 * - y = x^(2^T) can be verified efficiently using halving
 * - If μ = x^(2^(T/2)), then y = μ^(2^(T/2))
 * - Prover commits to μ, verifier checks consistency
 */

const crypto = require("crypto");
const { ethers } = require("hardhat");

// ============================================================
// MODULAR ARITHMETIC
// ============================================================

function modPow(base, exp, mod) {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  return result;
}

function hashToChallenge(x, y, mu, N) {
  // Create deterministic challenge from x, y, μ using simple hash
  const data = `${x.toString(16)}:${y.toString(16)}:${mu.toString(16)}:${N.toString(16)}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  // Use small challenge (128 bits) for efficiency
  return BigInt('0x' + hash.slice(0, 32));
}

// ============================================================
// PIETRZAK VDF CORE
// ============================================================

class PietrzakVDF {
  constructor(N, T) {
    this.N = N;  // RSA modulus
    this.T = T;  // Number of squarings
  }

  /**
   * Evaluate: compute y = x^(2^T) mod N
   */
  eval(x) {
    console.log(`\n🔄 Computing y = x^(2^${this.T}) mod N...`);
    const start = Date.now();
    
    let y = x % this.N;
    for (let i = 0; i < this.T; i++) {
      y = (y * y) % this.N;
      if (i % 10000 === 0 && i > 0) {
        process.stdout.write(`\r   Progress: ${((i/this.T)*100).toFixed(0)}%`);
      }
    }
    
    console.log(`\n   ⏱️  Time: ${Date.now() - start}ms`);
    return y;
  }

  /**
   * Generate proof using Pietrzak's halving protocol
   */
  prove(x, y) {
    console.log(`\n📝 Generating Pietrzak proof...`);
    
    const proof = [];
    let T = this.T;
    let currX = x;
    let currY = y;
    
    while (T >= 2) {
      const halfT = Math.floor(T / 2);
      
      // Compute μ = x^(2^(T/2)) mod N
      let mu = currX;
      for (let i = 0; i < halfT; i++) {
        mu = (mu * mu) % this.N;
      }
      
      proof.push(mu);
      
      // Fiat-Shamir challenge
      const r = hashToChallenge(currX, currY, mu, this.N);
      
      // Next iteration: verify that y = μ^(2^(T/2))
      // Update: x' = x^r * μ, y' = μ^r * y
      const xr = modPow(currX, r, this.N);
      const mur = modPow(mu, r, this.N);
      
      currX = (xr * mu) % this.N;
      currY = (mur * currY) % this.N;
      T = halfT;
    }
    
    console.log(`   Proof size: ${proof.length} elements (log₂(${this.T}) = ${Math.log2(this.T).toFixed(1)})`);
    return proof;
  }

  /**
   * Verify proof in O(log T) time
   */
  verify(x, y, proof) {
    console.log(`\n🔍 Verifying proof...`);
    const start = Date.now();
    
    let T = this.T;
    let currX = x;
    let currY = y;
    let idx = 0;
    
    while (T >= 2) {
      if (idx >= proof.length) {
        console.log(`   ❌ Proof too short`);
        return false;
      }
      
      const halfT = Math.floor(T / 2);
      const mu = proof[idx++];
      
      // Same Fiat-Shamir challenge
      const r = hashToChallenge(currX, currY, mu, this.N);
      
      // Update
      const xr = modPow(currX, r, this.N);
      const mur = modPow(mu, r, this.N);
      
      currX = (xr * mu) % this.N;
      currY = (mur * currY) % this.N;
      T = halfT;
    }
    
    // Final check: y' should equal x'^2 (since T=1 means one squaring)
    const expected = (currX * currX) % this.N;
    const valid = expected === currY;
    
    console.log(`   ⏱️  Verification time: ${Date.now() - start}ms`);
    console.log(`   ${valid ? '✅ VALID' : '❌ INVALID'}`);
    
    return valid;
  }
}

// ============================================================
// RSA MODULUS SETUP
// ============================================================

// For demo: 512-bit primes (NOT SECURE - use 2048+ bits in production)
const P = BigInt("13407807929942597099574024998205846127479365820592393377723561443721764030073546976801874298166903427690031858186486050853753882811946569946433649006084171");
const Q = BigInt("13407807929942597099574024998205846127479365820592393377723561443721764030073546976801874298166903427690031858186486050853753882811946569946433649006084241");
const N_DEMO = P * Q;

// RSA-2048 (unknown factorization - SECURE)
const N_RSA2048 = BigInt(
  "25195908475657893494027183240048398571429282126204032027777137836043662020707595556264018525880784406918290641249515082189298559149176184502808489120072844992687392807287776735971418347270261896375014971824691165077613379859095700097330459748808428401797429100642458691817195118746121515172654632282216869987549182422433637259085141865462043576798423387184774447920739934236584823824281198163815010674810451660377306056201619676256133844143603833904414952634432190114657544454178424020924616515723350778707749817125772467962926386356373289912154831438167899885040445364023527381951378636564391212010397122822120720357"
);

// ============================================================
// DEMO
// ============================================================

async function demo() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         Pietrzak VDF - Verifiable Delay Function             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // Configuration - T MUST be power of 2 for Pietrzak
  const T = 8192;  // 2^13 squarings
  const N = N_DEMO; // Use demo modulus for speed
  
  console.log(`\n⚙️  Configuration:`);
  console.log(`   T (squarings): ${T}`);
  console.log(`   N (modulus):   ${N.toString().slice(0, 30)}... (${N.toString(2).length} bits)`);

  // Input from commitment
  const commitment = "0xcd10618d23880f1629515e01c4f3d483e0603ec099c40d460bce722b10cf1731";
  const x = BigInt(commitment) % N;
  
  console.log(`\n📥 Input:`);
  console.log(`   commitment: ${commitment}`);
  console.log(`   x = ${x.toString().slice(0, 30)}...`);

  // Create VDF instance
  const vdf = new PietrzakVDF(N, T);

  // Evaluate (slow - sequential squarings)
  const y = vdf.eval(x);
  console.log(`\n📤 Output:`);
  console.log(`   y = ${y.toString().slice(0, 30)}...`);

  // Generate proof (also slow, but creates compact proof)
  const proof = vdf.prove(x, y);

  // Verify (fast - O(log T))
  const valid = vdf.verify(x, y, proof);

  // Summary
  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`📊 Summary:`);
  console.log(`   Eval time:     Sequential (T=${T} squarings)`);
  console.log(`   Proof size:    ${proof.length} group elements`);
  console.log(`   Verify time:   O(log T) = O(${Math.ceil(Math.log2(T))}) ops`);
  console.log(`   Result:        ${valid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`════════════════════════════════════════════════════════════════`);

  // For blockchain: hash the output
  const yHex = '0x' + y.toString(16).padStart(64, '0').slice(0, 64);
  const proofHash = ethers.keccak256(ethers.toUtf8Bytes(proof.map(p => p.toString()).join(',')));
  
  console.log(`\n🔗 For on-chain verification:`);
  console.log(`   VDF Output (Y): ${yHex}`);
  console.log(`   Proof Hash:     ${proofHash}`);

  return { x, y, proof, valid, yHex, proofHash };
}

// Export
module.exports = {
  PietrzakVDF,
  N_DEMO,
  N_RSA2048,
  modPow,
  demo
};

// Run
if (require.main === module) {
  demo()
    .then(() => {
      console.log("\n✅ Pietrzak VDF Demo completed!");
      process.exit(0);
    })
    .catch(err => {
      console.error("❌ Error:", err);
      process.exit(1);
    });
}
