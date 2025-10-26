// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AxelarGatewayMock {
    address public destinationContract;
    address public destinationChain;

    event MessageSent(address destChain, address destContract, bytes payload);

    constructor(address _destChain, address _destContract) {
        destinationChain = _destChain;
        destinationContract = _destContract;
    }

    // Tác nhân off-chain (ContractS, MPC, VDF) gọi hàm này
    function sendMessage(bytes calldata payload) external {
        emit MessageSent(destinationChain, destinationContract, payload);
    }

    // Relayer (script) gọi hàm này
    function receiveMessage(bytes calldata payload) external {
        // Gọi hợp đồng đích (ví dụ: ContractD)
        (bool success, ) = destinationContract.call(payload);
        require(success, "AxelarMock: Call to destination contract failed");
    }
}