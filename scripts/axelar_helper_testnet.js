const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Helper để gửi message qua Axelar testnet thực (Sepolia → Amoy)
 */

async function sendViaAxelar({
  srcChain, // "ethereum-sepolia"
  destChain, // "Polygon" (Axelar chain name)
  destAddress,
  functionSignature, // "storeCommitment(uint256,bytes32)"
  params // [sessionId, commitment]
}) {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const AXELAR_GATEWAY_SEPOLIA = process.env.AXELAR_GATEWAY_SEPOLIA;
  const AXELAR_GAS_SERVICE_SEPOLIA = process.env.AXELAR_GAS_SERVICE_SEPOLIA;

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`🌉 Sending message via Axelar...`);
  console.log(`   From: ${srcChain}`);
  console.log(`   To: ${destChain}`);
  console.log(`   Function: ${functionSignature}`);

  const gatewayABI = [
    "function callContract(string destinationChain, string destinationAddress, bytes payload) external",
  ];

  const gasServiceABI = [
    "function payNativeGasForContractCall(address sender, string destinationChain, string destinationAddress, bytes payload, address refundAddress) external payable",
  ];

  const gateway = new ethers.Contract(AXELAR_GATEWAY_SEPOLIA, gatewayABI, signer);
  const gasService = new ethers.Contract(AXELAR_GAS_SERVICE_SEPOLIA, gasServiceABI, signer);

  // Encode payload
  const iface = new ethers.Interface([`function ${functionSignature}`]);
  const payload = iface.encodeFunctionData(
    functionSignature.split("(")[0],
    params
  );

  // Estimate gas
  const gasLimit = await provider.estimateGas({
    to: gateway.target,
    data: gateway.interface.encodeFunctionData("callContract", [
      destChain,
      destAddress,
      payload
    ])
  });

  console.log(`   Gas required: ${gasLimit.toString()}`);

  // Get current gas price
  const gasPrice = await provider.getGasPrice();
  const totalGas = (gasLimit * gasPrice) / ethers.parseEther("1");

  console.log(`   Estimated cost: ${ethers.formatEther(totalGas)} ETH`);

  // Pay for gas + call contract
  const tx1 = await gasService.payNativeGasForContractCall(
    signer.address,
    destChain,
    destAddress,
    payload,
    signer.address,
    { value: ethers.parseEther("0.01") } // Adjust as needed
  );

  console.log(`   💰 Gas payment tx: ${tx1.hash}`);
  await tx1.wait();

  // Call contract
  const tx2 = await gateway.callContract(destChain, destAddress, payload);
  console.log(`   📤 Contract call tx: ${tx2.hash}`);
  
  const receipt = await tx2.wait();
  console.log(`   ✅ Message sent! Gas used: ${receipt.gasUsed.toString()}`);

  return tx2.hash;
}

module.exports = { sendViaAxelar };