// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AxelarGatewayMock.sol";

contract ContractS {
    AxelarGatewayMock public gateway;
    uint256 public currentSessionId;
    bytes32 public currentCommitment;

    event RandomnessRequested(uint256 indexed sessionId);
    event CommitmentSubmitted(uint256 indexed sessionId, bytes32 commitment);

    constructor(address _gatewayAddress) {
        gateway = AxelarGatewayMock(_gatewayAddress);
    }

    function RequestRandomness(uint256 _sessionId) external {
        currentSessionId = _sessionId;
        emit RandomnessRequested(_sessionId);
    }

    function SubmitCommitment(bytes32 _commitment) external {
        currentCommitment = _commitment;
        emit CommitmentSubmitted(currentSessionId, _commitment);

        // (4b) Gửi commitment qua Axelar
        bytes memory payload = abi.encodeWithSelector(
            bytes4(keccak256("storeCommitment(uint256,bytes32)")),
            currentSessionId,
            _commitment
        );
        gateway.sendMessage(payload);
    }
}