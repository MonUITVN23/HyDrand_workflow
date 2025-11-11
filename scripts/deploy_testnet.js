const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🚀 Deploying to Axelar Testnet (Sepolia + Amoy)\n");

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const AXELAR_GATEWAY_AMOY = process.env.AXELAR_GATEWAY_AMOY;
  const AXELAR_GAS_SERVICE_AMOY = process.env.AXELAR_GAS_SERVICE_AMOY;
  const AXELAR_GATEWAY_SEPOLIA = process.env.AXELAR_GATEWAY_SEPOLIA;
  const AXELAR_GAS_SERVICE_SEPOLIA = process.env.AXELAR_GAS_SERVICE_SEPOLIA;

  if (!AXELAR_GATEWAY_AMOY || !AXELAR_GATEWAY_SEPOLIA) {
    throw new Error("Missing Axelar Gateway addresses in .env");
  }

  // ==================== DEPLOY TO AMOY (Destination) ====================
  console.log("📍 Deploying to Polygon Amoy (Destination Chain)...\n");
  
  const amoyProvider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  const amoySigner = new ethers.Wallet(PRIVATE_KEY, amoyProvider);

  console.log(`   Account: ${amoySigner.address}`);
  const balance = await amoyProvider.getBalance(amoySigner.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} POL\n`);

  console.log("   Deploying OnChainVerifier...");
  const Verifier = await ethers.getContractFactory("OnChainVerifier", amoySigner);
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log(`   ✅ OnChainVerifier: ${verifierAddr}\n`);

  console.log("   Deploying ContractD...");
  const ContractD = await ethers.getContractFactory("ContractD", amoySigner);
  const contractD = await ContractD.deploy(
    AXELAR_GATEWAY_AMOY,
    verifierAddr,
    "0x0000000000000000000000000000000000000000" // Will be set after Sepolia deploy
  );
  await contractD.waitForDeployment();
  const contractDAddr = await contractD.getAddress();
  console.log(`   ✅ ContractD: ${contractDAddr}\n`);

  // ==================== DEPLOY TO SEPOLIA (Source) ====================
  console.log("📍 Deploying to Ethereum Sepolia (Source Chain)...\n");

  const sepoliaProvider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const sepoliaSigner = new ethers.Wallet(PRIVATE_KEY, sepoliaProvider);

  console.log(`   Account: ${sepoliaSigner.address}`);
  const sepoliaBalance = await sepoliaProvider.getBalance(sepoliaSigner.address);
  console.log(`   Balance: ${ethers.formatEther(sepoliaBalance)} ETH\n`);

  console.log("   Deploying ContractS...");
  const ContractS = await ethers.getContractFactory("ContractS", sepoliaSigner);
  const contractS = await ContractS.deploy(
    AXELAR_GATEWAY_SEPOLIA,
    AXELAR_GAS_SERVICE_SEPOLIA,
    contractDAddr
  );
  await contractS.waitForDeployment();
  const contractSAddr = await contractS.getAddress();
  console.log(`   ✅ ContractS: ${contractSAddr}\n`);

  console.log("═".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETED!");
  console.log("═".repeat(60));
  console.log("\n📝 Copy these to your .env:\n");
  console.log(`CONTRACT_S_ADDR="${contractSAddr}"`);
  console.log(`CONTRACT_D_ADDR="${contractDAddr}"`);
  console.log(`VERIFIER_B_ADDR="${verifierAddr}"`);
  console.log("\n⚡ Fund your account with testnet tokens:");
  console.log(`   Sepolia ETH: https://www.sepoliafaucet.io/`);
  console.log(`   Amoy POL: https://faucet.polygon.technology/`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});