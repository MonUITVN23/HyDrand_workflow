// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OnChainVerifier {
    mapping(uint256 => bytes32) public randomness;
    
    event RandomnessReceived(uint256 indexed sessionId, bytes32 randomness);

    function receiveRandomness(uint256 _sessionId, bytes32 _randomness) external {
        randomness[_sessionId] = _randomness;
        emit RandomnessReceived(_sessionId, _randomness);
    }
}