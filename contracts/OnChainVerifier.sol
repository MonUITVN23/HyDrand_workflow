// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OnChainVerifier {
    bytes32 public lastRandomness;
    uint256 public lastSessionId;

    event RandomnessDelivered(uint256 indexed sessionId, bytes32 randomness);

    function receiveRandomness(uint256 sessionId, bytes32 randomness) external {
        lastRandomness = randomness;
        lastSessionId = sessionId;
        emit RandomnessDelivered(sessionId, randomness);
    }
}