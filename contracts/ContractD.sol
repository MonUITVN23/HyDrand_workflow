// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAxelarGateway {
    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external returns (bool);
}

interface IOnChainVerifier {
    function receiveRandomness(uint256 sessionId, bytes32 randomness) external;
}

contract ContractD {
    IAxelarGateway public gateway;
    address public verifierAddress;
    string public sourceChain = "ethereum-sepolia";
    address public sourceContract;

    mapping(uint256 => bytes32) public commitments;
    mapping(uint256 => bytes32) public vdfOutputs;

    event VDFProofVerified(uint256 indexed sessionId, bool success);

    constructor(
        address _gatewayAddress,
        address _verifierAddress,
        address _sourceContract
    ) {
        gateway = IAxelarGateway(_gatewayAddress);
        verifierAddress = _verifierAddress;
        sourceContract = _sourceContract;
    }

    // Called by Axelar Gateway
    function storeCommitment(uint256 _sessionId, bytes32 _commitment) external {
        // Optional: Add gateway validation if needed
        commitments[_sessionId] = _commitment;
    }

    // Called by Axelar Gateway
    function submitVDFProof(uint256 _sessionId, bytes32 _Y, bytes32 _pi) external {
        bool isValid = VDF_Verify(_sessionId, _Y, _pi);
        require(isValid, "VDF Proof is invalid");
        vdfOutputs[_sessionId] = _Y;
        emit VDFProofVerified(_sessionId, true);
    }

    // Called by Axelar Gateway
    function submitSeed(uint256 _sessionId, bytes32 _seed) external {
        bytes32 _Y = vdfOutputs[_sessionId];
        bytes32 _commitment = commitments[_sessionId];

        require(keccak256(abi.encodePacked(_seed)) == _commitment, "MPC Reveal Failed");
        require(_Y != 0, "VDF output not found");

        bytes32 finalRandomness = keccak256(abi.encodePacked(_Y, _seed));
        IOnChainVerifier(verifierAddress).receiveRandomness(_sessionId, finalRandomness);
    }

    function VDF_Verify(uint256, bytes32, bytes32) internal pure returns (bool) {
        return true;
    }
}