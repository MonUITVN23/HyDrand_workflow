# DRNG Proof of Concept

This project demonstrates a **Distributed Random Number Generator (DRNG)** with cross-chain communication using:
- **MPC (Multi-Party Computation)** for seed generation
- **VDF (Verifiable Delay Function)** for time-delay proof
- **Axelar-like Gateway** for cross-chain messaging

## Architecture

### Chain A (Source Chain)
- `ContractS`: Initiates randomness requests and submits commitments
- `GatewayA`: Sends cross-chain messages

### Chain B (Destination Chain)
- `ContractD`: Receives commitments, verifies VDF proofs, and processes seeds
- `OnChainVerifier`: Receives final randomness
- `GatewayB`: Receives cross-chain messages

### Off-Chain Components
- **Axelar Relayer**: Listens to Chain A events and forwards to Chain B
- **MPC Script**: Generates seed and commitment, then reveals seed
- **VDF Script**: Computes VDF proof from commitment

## Workflow

```
1. ContractS.RequestRandomness(sessionId)
2. MPC generates seed → commitment = H(seed)
3. ContractS.SubmitCommitment(commitment)
   └→ Relayer forwards to ContractD.storeCommitment()
4. VDF computes proof from commitment
   └→ Relayer forwards to ContractD.submitVDFProof()
5. MPC reveals seed
   └→ Relayer forwards to ContractD.submitSeed()
6. ContractD verifies & computes: finalRandomness = H(VDF_output, seed)
7. OnChainVerifier receives final randomness
```

## Setup & Running

### Prerequisites
```bash
npm install
```

### 1. Start Two Local Chains

**Terminal 1 - Chain A:**
```bash
npx hardhat node --port 8545
```

**Terminal 2 - Chain B:**
```bash
npx hardhat node --port 9545
```

### 2. Deploy Contracts

**Terminal 3:**
```bash
export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
npx hardhat run scripts/deploy.js --network localhost
```

Save the output addresses and export them:
```bash
export CONTRACT_S_ADDR="<address>"
export GATEWAY_A_ADDR="<address>"
export CONTRACT_D_ADDR="<address>"
export GATEWAY_B_ADDR="<address>"
export VERIFIER_B_ADDR="<address>"
```

### 3. Start Axelar Relayer

**Terminal 4:**
```bash
node scripts/alexar_relayer.js
```

Keep this running to relay messages between chains.

### 4. Run Full Test Workflow

**Terminal 5:**
```bash
node scripts/run_test.js
```

This will:
- Request randomness
- Generate MPC seed/commitment
- Submit commitment (relayed to Chain B)
- Compute VDF proof (relayed to Chain B)
- Reveal seed (relayed to Chain B)
- Verify final randomness on Chain B

## Manual Testing

You can also run individual components:

### Generate MPC Seed
```bash
node scripts/mpc_script.js <sessionId>
```

### Compute VDF Proof
```bash
node scripts/vdf_script.js <sessionId> <commitment>
```

### Reveal Seed (after VDF is verified)
```javascript
const { revealSeed } = require('./scripts/mpc_script');
revealSeed(sessionId);
```

## Key Fixes Applied

1. ✅ Changed `staticcall` to `call` in AxelarGatewayMock (allows state changes)
2. ✅ Created Axelar Relayer to bridge messages between chains
3. ✅ Implemented MPC script for seed generation and reveal
4. ✅ Implemented VDF script for proof computation
5. ✅ Created orchestration script for full workflow testing
6. ✅ Added proper event listening and message forwarding

## Notes

- This is a **mock/POC implementation** for testing workflow
- Real VDF computation is mocked with `VDF_Verify() returning true`
- Real MPC is simulated with random seed generation
- Gateway uses mock implementation instead of actual Axelar protocol
