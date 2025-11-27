// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOnChainVerifier {
    function receiveRandomness(uint256 sessionId, bytes32 randomness) external;
}

interface IAxelarGateway {
    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external returns (bool);
}

contract ContractD {
    IOnChainVerifier public verifier;
    IAxelarGateway public gateway;
    
    string public constant SOURCE_CHAIN = "ethereum-sepolia";
    address public sourceContract; // ContractS address on Sepolia
    
    mapping(uint256 => bytes32) public commitments;
    mapping(uint256 => bytes32) public vdfOutputs;

    event CommitmentStored(uint256 indexed sessionId, bytes32 commitment);
    event VDFProofVerified(uint256 indexed sessionId);
    event SeedSubmitted(uint256 indexed sessionId, bytes32 finalRandomness);

    constructor(
        address _gatewayAddress,
        address _verifierAddress
    ) {
        gateway = IAxelarGateway(_gatewayAddress);
        verifier = IOnChainVerifier(_verifierAddress);
    }
    
    // Set the source contract address (ContractS on Sepolia)
    function setSourceContract(address _sourceContract) external {
        require(sourceContract == address(0), "Already set");
        sourceContract = _sourceContract;
    }

    // Manual call from anyone (for testing without Axelar relay)
    function storeCommitment(uint256 _sessionId, bytes32 _commitment) external {
        commitments[_sessionId] = _commitment;
        emit CommitmentStored(_sessionId, _commitment);
    }
    
    // Called by Axelar relayer - GMP execute
    function execute(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        // Validate the call came from Axelar Gateway
        bytes32 payloadHash = keccak256(payload);
        require(
            gateway.validateContractCall(commandId, sourceChain, sourceAddress, payloadHash),
            "Not approved by gateway"
        );
        
        // Decode and execute
        (uint256 sessionId, bytes32 commitment) = abi.decode(payload, (uint256, bytes32));
        commitments[sessionId] = commitment;
        emit CommitmentStored(sessionId, commitment);
    }

    function submitVDFProof(uint256 _sessionId, bytes32 _Y, bytes32 /*_pi*/) external {
        require(_Y != 0, "Invalid VDF output");
        vdfOutputs[_sessionId] = _Y;
        emit VDFProofVerified(_sessionId);
    }

    function submitSeed(uint256 _sessionId, bytes32 _seed) external {
        bytes32 _Y = vdfOutputs[_sessionId];
        bytes32 _commitment = commitments[_sessionId];

        require(_Y != 0, "VDF not submitted");
        require(keccak256(abi.encodePacked(_seed)) == _commitment, "Invalid seed");

        bytes32 finalRandomness = keccak256(abi.encodePacked(_Y, _seed));
        verifier.receiveRandomness(_sessionId, finalRandomness);
        
        emit SeedSubmitted(_sessionId, finalRandomness);
    }
}