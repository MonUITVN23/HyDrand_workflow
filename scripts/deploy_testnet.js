const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🚀 Deploying DRNG to Axelar Testnet (Sepolia → Amoy)\n");

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const AXELAR_GATEWAY_AMOY = process.env.AXELAR_GATEWAY_AMOY;
  const AXELAR_GATEWAY_SEPOLIA = process.env.AXELAR_GATEWAY_SEPOLIA;
  const AXELAR_GAS_SERVICE_SEPOLIA = process.env.AXELAR_GAS_SERVICE_SEPOLIA;

  // ==================== DEPLOY TO AMOY (Destination) ====================
  console.log("📍 Step 1: Deploying to Polygon Amoy (Destination)...\n");
  
  const amoyProvider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  const amoySigner = new ethers.Wallet(PRIVATE_KEY, amoyProvider);

  const amoyBalance = await amoyProvider.getBalance(amoySigner.address);
  console.log(`   Account: ${amoySigner.address}`);
  console.log(`   Balance: ${ethers.formatEther(amoyBalance)} POL\n`);

  if (amoyBalance === 0n) {
    throw new Error("No POL balance! Get from https://faucet.polygon.technology/");
  }

  // Deploy OnChainVerifier
  console.log("   Deploying OnChainVerifier...");
  const Verifier = await ethers.getContractFactory("OnChainVerifier", amoySigner);
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log(`   ✅ OnChainVerifier: ${verifierAddr}`);

  // Deploy ContractD
  console.log("   Deploying ContractD...");
  const ContractD = await ethers.getContractFactory("ContractD", amoySigner);
  const contractD = await ContractD.deploy(AXELAR_GATEWAY_AMOY, verifierAddr);
  await contractD.waitForDeployment();
  const contractDAddr = await contractD.getAddress();
  console.log(`   ✅ ContractD: ${contractDAddr}\n`);

  // ==================== DEPLOY TO SEPOLIA (Source) ====================
  console.log("📍 Step 2: Deploying to Ethereum Sepolia (Source)...\n");

  const sepoliaProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const sepoliaSigner = new ethers.Wallet(PRIVATE_KEY, sepoliaProvider);

  const sepoliaBalance = await sepoliaProvider.getBalance(sepoliaSigner.address);
  console.log(`   Account: ${sepoliaSigner.address}`);
  console.log(`   Balance: ${ethers.formatEther(sepoliaBalance)} ETH\n`);

  if (sepoliaBalance === 0n) {
    throw new Error("No ETH balance! Get from https://www.sepoliafaucet.io/");
  }

  // Deploy ContractS
  console.log("   Deploying ContractS...");
  console.log(`   - Gateway: ${AXELAR_GATEWAY_SEPOLIA}`);
  console.log(`   - GasService: ${AXELAR_GAS_SERVICE_SEPOLIA}`);
  console.log(`   - DestContract: ${contractDAddr}`);
  
  const ContractS = await ethers.getContractFactory("ContractS", sepoliaSigner);
  const contractS = await ContractS.deploy(
    AXELAR_GATEWAY_SEPOLIA,
    AXELAR_GAS_SERVICE_SEPOLIA,
    contractDAddr
  );
  await contractS.waitForDeployment();
  const contractSAddr = await contractS.getAddress();
  console.log(`   ✅ ContractS: ${contractSAddr}\n`);

  // ==================== VERIFY DEPLOYMENT ====================
  console.log("📋 Verifying deployment...\n");
  
  const ContractS_ABI = [
    "function gateway() view returns (address)",
    "function gasService() view returns (address)",
    "function destContractAddress() view returns (address)",
    "function DEST_CHAIN() view returns (string)"
  ];
  
  const deployedContractS = new ethers.Contract(contractSAddr, ContractS_ABI, sepoliaSigner);
  const destChain = await deployedContractS.DEST_CHAIN();
  const gateway = await deployedContractS.gateway();
  const gasService = await deployedContractS.gasService();
  const destContract = await deployedContractS.destContractAddress();
  
  console.log(`   DEST_CHAIN: "${destChain}" ${destChain === "polygon-amoy" ? "✅" : "❌"}`);
  console.log(`   Gateway: ${gateway}`);
  console.log(`   GasService: ${gasService}`);
  console.log(`   DestContract: ${destContract}\n`);

  // ==================== OUTPUT ====================
  console.log("═".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETED!");
  console.log("═".repeat(60));
  console.log(`\n📝 Update your .env file:\n`);
  console.log(`CONTRACT_S_ADDR=${contractSAddr}`);
  console.log(`CONTRACT_D_ADDR=${contractDAddr}`);
  console.log(`VERIFIER_B_ADDR=${verifierAddr}`);
  console.log(`\n🔗 View on explorers:`);
  console.log(`   Sepolia: https://sepolia.etherscan.io/address/${contractSAddr}`);
  console.log(`   Amoy: https://amoy.polygonscan.com/address/${contractDAddr}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});