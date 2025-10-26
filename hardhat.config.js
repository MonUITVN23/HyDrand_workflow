require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Tải biến môi trường từ .env

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY không được tìm thấy trong file .env");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    // Chain A: Nguồn (Source)
    chainA: {
      url: "http://127.0.0.1:8545",
      accounts: [PRIVATE_KEY],
      chainId: 31337,
      mining: { // Mô phỏng thời gian khối
        auto: false,
        interval: 2000 // 2 giây 1 khối
      }
    },
    // Chain B: Đích (Destination)
    chainB: {
      url: "http://127.0.0.1:9545",
      accounts: [PRIVATE_KEY],
      chainId: 31338, // ChainID khác
      mining: { // Mô phỏng thời gian khối
        auto: false,
        interval: 2000 // 2 giây 1 khối
      }
    }
  }
};