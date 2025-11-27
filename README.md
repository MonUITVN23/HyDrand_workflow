# DRNG-POC: Distributed Random Number Generator# DRNG Proof of Concept



A secure cross-chain distributed randomness system using **MPC**, **Pietrzak VDF**, and **Axelar GMP**.This project demonstrates a **Distributed Random Number Generator (DRNG)** with cross-chain communication using:

- **MPC (Multi-Party Computation)** for seed generation

## 🏗️ Architecture- **VDF (Verifiable Delay Function)** for time-delay proof

- **Axelar-like Gateway** for cross-chain messaging

```

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐## Architecture

│   MPC Nodes     │────▶│  Pietrzak VDF   │────▶│  Axelar GMP     │

│   (3-of-5)      │     │  (T=8192)       │     │  Cross-Chain    │### Chain A (Source Chain)

└─────────────────┘     └─────────────────┘     └─────────────────┘- `ContractS`: Initiates randomness requests and submits commitments

        │                       │                       │- `GatewayA`: Sends cross-chain messages

        ▼                       ▼                       ▼

   Shamir's SSS          Sequential Delay         Sepolia → Amoy### Chain B (Destination Chain)

```- `ContractD`: Receives commitments, verifies VDF proofs, and processes seeds

- `OnChainVerifier`: Receives final randomness

## 🔐 Security Properties- `GatewayB`: Receives cross-chain messages



| Property | Mechanism |### Off-Chain Components

|----------|-----------|- **Axelar Relayer**: Listens to Chain A events and forwards to Chain B

| **Bias Resistance** | VDF prevents last-revealer attack |- **MPC Script**: Generates seed and commitment, then reveals seed

| **Unpredictability** | MPC commit-reveal + threshold |- **VDF Script**: Computes VDF proof from commitment

| **Verifiability** | On-chain VDF proof verification |

| **Cross-Chain** | Axelar GMP message passing |## Workflow



## 📦 Project Structure```

1. ContractS.RequestRandomness(sessionId)

```2. MPC generates seed → commitment = H(seed)

drng-poc/3. ContractS.SubmitCommitment(commitment)

├── contracts/   └→ Relayer forwards to ContractD.storeCommitment()

│   ├── ContractS.sol       # Source chain (Sepolia)4. VDF computes proof from commitment

│   ├── ContractD.sol       # Destination chain (Amoy)   └→ Relayer forwards to ContractD.submitVDFProof()

│   └── OnChainVerifier.sol # Randomness consumer5. MPC reveals seed

├── scripts/   └→ Relayer forwards to ContractD.submitSeed()

│   ├── mpc_simulation.js   # MPC with Shamir's Secret Sharing6. ContractD verifies & computes: finalRandomness = H(VDF_output, seed)

│   ├── vdf_implementation.js # Pietrzak VDF7. OnChainVerifier receives final randomness

│   ├── attack_simulation.js  # RANDAO vs Our System comparison```

│   ├── workflow_fast.js    # Quick local test

│   ├── complete_workflow.js # Full Axelar integration## Setup & Running

│   └── deploy_testnet.js   # Deploy to testnet

└── hardhat.config.js### Prerequisites

``````bash

npm install

## 🚀 Quick Start```



### 1. Install Dependencies### 1. Start Two Local Chains

```bash

npm install**Terminal 1 - Chain A:**

``````bash

npx hardhat node --port 8545

### 2. Setup Environment```

```bash

cp .env.example .env**Terminal 2 - Chain B:**

# Edit .env with your keys```bash

```npx hardhat node --port 9545

```

### 3. Demo Commands

### 2. Deploy Contracts

```bash

# MPC Demo (Shamir's Secret Sharing)**Terminal 3:**

npm run mpc:demo```bash

export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# VDF Demo (Pietrzak protocol)npx hardhat run scripts/deploy.js --network localhost

npm run vdf:demo```



# Attack Simulation (RANDAO vs Our System)Save the output addresses and export them:

npm run attack:demo```bash

export CONTRACT_S_ADDR="<address>"

# Fast DRNG (local test, no Axelar wait)export GATEWAY_A_ADDR="<address>"

npm run drng:fastexport CONTRACT_D_ADDR="<address>"

export GATEWAY_B_ADDR="<address>"

# Full DRNG (with Axelar cross-chain)export VERIFIER_B_ADDR="<address>"

npm run drng:full```

```

### 3. Start Axelar Relayer

## 🔬 Cryptographic Components

**Terminal 4:**

### MPC (Multi-Party Computation)```bash

- **Scheme**: Shamir's Secret Sharingnode scripts/alexar_relayer.js

- **Threshold**: 3-of-5```

- **Protocol**: Commit-Reveal with XOR combining

Keep this running to relay messages between chains.

### VDF (Verifiable Delay Function)

- **Algorithm**: Pietrzak (2018)### 4. Run Full Test Workflow

- **T**: 8192 sequential squarings

- **Proof**: O(log T) = 13 group elements**Terminal 5:**

- **Verification**: O(log T) time```bash

node scripts/run_test.js

### Cross-Chain```

- **Protocol**: Axelar GMP

- **Source**: Ethereum SepoliaThis will:

- **Destination**: Polygon Amoy- Request randomness

- Generate MPC seed/commitment

## 🛡️ Security Comparison- Submit commitment (relayed to Chain B)

- Compute VDF proof (relayed to Chain B)

| Attack Vector | RANDAO | Our System |- Reveal seed (relayed to Chain B)

|---------------|--------|------------|- Verify final randomness on Chain B

| Last-revealer bias | ❌ Vulnerable | ✅ Secure (VDF) |

| Skip attack | ❌ Possible | ✅ Impossible |## Manual Testing

| Predictability | ⚠️ 12s window | ✅ VDF delay |

| Single point of failure | ⚠️ Validator | ✅ 3-of-5 threshold |You can also run individual components:



## 📊 Performance### Generate MPC Seed

```bash

| Metric | Value |node scripts/mpc_script.js <sessionId>

|--------|-------|```

| VDF Eval Time | ~11ms (T=8192) |

| VDF Verify Time | ~9ms |### Compute VDF Proof

| Proof Size | 13 elements |```bash

| Axelar Relay | ~15-20 min (testnet) |node scripts/vdf_script.js <sessionId> <commitment>

```

## 🔗 Deployed Contracts (Testnet)

### Reveal Seed (after VDF is verified)

| Contract | Network | Address |```javascript

|----------|---------|---------|const { revealSeed } = require('./scripts/mpc_script');

| ContractS | Sepolia | `CONTRACT_S_ADDR` in .env |revealSeed(sessionId);

| ContractD | Amoy | `CONTRACT_D_ADDR` in .env |```

| Verifier | Amoy | `VERIFIER_B_ADDR` in .env |

## Key Fixes Applied

## 📚 References

1. ✅ Changed `staticcall` to `call` in AxelarGatewayMock (allows state changes)

- [Pietrzak VDF](https://eprint.iacr.org/2018/627) - Simple Verifiable Delay Functions2. ✅ Created Axelar Relayer to bridge messages between chains

- [Shamir's Secret Sharing](https://en.wikipedia.org/wiki/Shamir%27s_secret_sharing)3. ✅ Implemented MPC script for seed generation and reveal

- [Axelar GMP](https://docs.axelar.dev/dev/general-message-passing/overview)4. ✅ Implemented VDF script for proof computation

- [RANDAO](https://eth2book.info/capella/part2/building_blocks/randomness/)5. ✅ Created orchestration script for full workflow testing

6. ✅ Added proper event listening and message forwarding

## 📄 License

## Notes

MIT

- This is a **mock/POC implementation** for testing workflow
- Real VDF computation is mocked with `VDF_Verify() returning true`
- Real MPC is simulated with random seed generation
- Gateway uses mock implementation instead of actual Axelar protocol
