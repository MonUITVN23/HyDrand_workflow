// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOnChainVerifier {
    function receiveRandomness(uint256 sessionId, bytes32 randomness) external;
}

contract ContractD {
    address public verifierAddress;
    mapping(uint256 => bytes32) public commitments;
    mapping(uint256 => bytes32) public vdfOutputs; // Y

    event VDFProofVerified(uint256 indexed sessionId, bool success);

    constructor(address _verifierAddress) {
        verifierAddress = _verifierAddress;
    }

    // (4b) Axelar gọi hàm này
    function storeCommitment(uint256 _sessionId, bytes32 _commitment) external {
        commitments[_sessionId] = _commitment;
    }

    // (5) Axelar gọi hàm này
    function submitVDFProof(uint256 _sessionId, bytes32 _Y, bytes32 _pi) external {
        // Mock VDF_Verify
        bool isValid = VDF_Verify(_sessionId, _Y, _pi); 
        require(isValid, "VDF Proof is invalid");

        vdfOutputs[_sessionId] = _Y;
        emit VDFProofVerified(_sessionId, true);
    }

    // (6) Axelar gọi hàm này
    function submitSeed(uint256 _sessionId, bytes32 _seed) external {
        bytes32 _Y = vdfOutputs[_sessionId];
        bytes32 _commitment = commitments[_sessionId];

        // 1. Xác minh MPC (H(seed) == comm)
        require(keccak256(abi.encodePacked(_seed)) == _commitment, "MPC Reveal Failed");
        
        // 2. Xác minh VDF (đã chạy ở trên)
        require(_Y != 0, "VDF output not found");

        // 3. Tính toán & Gửi
        bytes32 finalRandomness = keccak256(abi.encodePacked(_Y, _seed));
        IOnChainVerifier(verifierAddress).receiveRandomness(_sessionId, finalRandomness);
    }

    // Mock VDF_Verify - Luôn trả về true để test luồng
    function VDF_Verify(uint256, bytes32, bytes32) internal pure returns (bool) {
        return true; 
    }
}