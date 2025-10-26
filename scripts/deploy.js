const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying contracts with the account:", process.env.PRIVATE_KEY.slice(0, 10) + "...");
  console.log();

  // --- TRIỂN KHAI LÊN CHAIN B (Đích) ---
  console.log("🔵 Deploying to Chain B (Destination)...");
  const chainB_provider = new ethers.JsonRpcProvider("http://localhost:9545");
  const deployerB = new ethers.Wallet(process.env.PRIVATE_KEY, chainB_provider);

  // Get starting nonce
  const nonceB = await deployerB.getNonce();
  console.log(`   Starting nonce on Chain B: ${nonceB}`);
  
  console.log("   Deploying OnChainVerifier...");
  const Verifier = await ethers.getContractFactory("OnChainVerifier", deployerB);
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log(`   ✅ OnChainVerifier deployed to: ${verifierAddr}`);
  
  // Small delay to ensure nonce updates
  await sleep(1000);

  console.log("   Deploying ContractD...");
  const ContractD = await ethers.getContractFactory("ContractD", deployerB);
  const contractD = await ContractD.deploy(verifierAddr);
  await contractD.waitForDeployment();
  const contractDAddr = await contractD.getAddress();
  console.log(`   ✅ ContractD deployed to: ${contractDAddr}`);
  
  await sleep(1000);

  console.log("   Deploying GatewayB...");
  const GatewayB = await ethers.getContractFactory("AxelarGatewayMock", deployerB);
  const gatewayB = await GatewayB.deploy(deployerB.address, contractDAddr);
  await gatewayB.waitForDeployment();
  const gatewayBAddr = await gatewayB.getAddress();
  console.log(`   ✅ GatewayB deployed to: ${gatewayBAddr}`);
  console.log();

  await sleep(1000);

  // --- TRIỂN KHAI LÊN CHAIN A (Nguồn) ---
  console.log("🟢 Deploying to Chain A (Source)...");
  const chainA_provider = new ethers.JsonRpcProvider("http://localhost:8545");
  const deployerA = new ethers.Wallet(process.env.PRIVATE_KEY, chainA_provider);
  
  const nonceA = await deployerA.getNonce();
  console.log(`   Starting nonce on Chain A: ${nonceA}`);
  
  console.log("   Deploying GatewayA...");
  const GatewayA = await ethers.getContractFactory("AxelarGatewayMock", deployerA);
  const gatewayA = await GatewayA.deploy(deployerA.address, gatewayBAddr);
  await gatewayA.waitForDeployment();
  const gatewayAAddr = await gatewayA.getAddress();
  console.log(`   ✅ GatewayA deployed to: ${gatewayAAddr}`);
  
  await sleep(1000);

  console.log("   Deploying ContractS...");
  const ContractS = await ethers.getContractFactory("ContractS", deployerA);
  const contractS = await ContractS.deploy(gatewayAAddr);
  await contractS.waitForDeployment();
  const contractSAddr = await contractS.getAddress();
  console.log(`   ✅ ContractS deployed to: ${contractSAddr}`);

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("✅ DEPLOYMENT COMPLETED SUCCESSFULLY!");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("📝 Copy these addresses to your .env file:");
  console.log();
  console.log(`CONTRACT_S_ADDR="${contractSAddr}"`);
  console.log(`GATEWAY_A_ADDR="${gatewayAAddr}"`);
  console.log(`CONTRACT_D_ADDR="${contractDAddr}"`);
  console.log(`GATEWAY_B_ADDR="${gatewayBAddr}"`);
  console.log(`VERIFIER_B_ADDR="${verifierAddr}"`);
  console.log();
  console.log("═══════════════════════════════════════════════════");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:");
  console.error(error);
  process.exit(1);
});