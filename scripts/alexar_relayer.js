const { ethers } = require("hardhat");

// Cấu hình địa chỉ (thay bằng địa chỉ từ deploy.js)
const CONFIG = {
  GATEWAY_A_ADDR: process.env.GATEWAY_A_ADDR || "",
  GATEWAY_B_ADDR: process.env.GATEWAY_B_ADDR || "",
  CHAIN_A_RPC: "http://localhost:8545",
  CHAIN_B_RPC: "http://localhost:9545",
};

async function main() {
  console.log("🔄 Starting Axelar Relayer...");

  // Kết nối đến cả hai chain
  const providerA = new ethers.JsonRpcProvider(CONFIG.CHAIN_A_RPC);
  const providerB = new ethers.JsonRpcProvider(CONFIG.CHAIN_B_RPC);
  
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, providerB);

  // Kết nối đến Gateway contracts
  const gatewayA = new ethers.Contract(
    CONFIG.GATEWAY_A_ADDR,
    [
      "event MessageSent(address destChain, address destContract, bytes payload)",
      "function sendMessage(bytes calldata payload) external"
    ],
    providerA
  );

  const gatewayB = new ethers.Contract(
    CONFIG.GATEWAY_B_ADDR,
    ["function receiveMessage(bytes calldata payload) external"],
    signer
  );

  console.log(`✅ Listening to GatewayA at ${CONFIG.GATEWAY_A_ADDR}`);
  console.log(`✅ Will relay to GatewayB at ${CONFIG.GATEWAY_B_ADDR}`);

  // Lắng nghe sự kiện MessageSent từ Chain A
  gatewayA.on("MessageSent", async (destChain, destContract, payload, event) => {
    console.log("\n📨 New message detected on Chain A!");
    console.log(`   Destination Chain: ${destChain}`);
    console.log(`   Destination Contract: ${destContract}`);
    console.log(`   Payload: ${payload}`);
    console.log(`   Block: ${event.log.blockNumber}`);

    try {
      // Gửi message đến Chain B
      console.log("🚀 Relaying message to Chain B...");
      const tx = await gatewayB.receiveMessage(payload);
      console.log(`   Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Message relayed successfully! Gas used: ${receipt.gasUsed.toString()}`);
    } catch (error) {
      console.error("❌ Error relaying message:", error.message);
    }
  });

  console.log("\n👂 Relayer is now listening for events...\n");
  
  // Keep the process running
  await new Promise(() => {});
}

main().catch((error) => {
  console.error("❌ Relayer error:", error);
  process.exit(1);
});
