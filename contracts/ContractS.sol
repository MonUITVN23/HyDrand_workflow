// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAxelarGateway {
    function callContract(
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload
    ) external;
}

interface IAxelarGasService {
    function payNativeGasForContractCall(
        address sender,
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload,
        address refundAddress
    ) external payable;
}

contract ContractS {
    IAxelarGateway public gateway;
    IAxelarGasService public gasService;
    
    string public constant DEST_CHAIN = "Polygon";
    address public destContractAddress;
    
    uint256 public currentSessionId;
    bytes32 public currentCommitment;

    event RandomnessRequested(uint256 indexed sessionId);
    event CommitmentSubmitted(uint256 indexed sessionId, bytes32 commitment);

    constructor(
        address _gatewayAddress,
        address _gasServiceAddress,
        address _destContractAddress
    ) {
        gateway = IAxelarGateway(_gatewayAddress);
        gasService = IAxelarGasService(_gasServiceAddress);
        destContractAddress = _destContractAddress;
    }

    function RequestRandomness(uint256 _sessionId) external {
        currentSessionId = _sessionId;
        emit RandomnessRequested(_sessionId);
    }

    function SubmitCommitment(bytes32 _commitment) external payable {
        currentCommitment = _commitment;
        emit CommitmentSubmitted(currentSessionId, _commitment);

        // Encode payload for storeCommitment function on ContractD
        bytes memory payload = abi.encodeWithSignature(
            "storeCommitment(uint256,bytes32)",
            currentSessionId,
            _commitment
        );

        // Pay gas for cross-chain call
        gasService.payNativeGasForContractCall{value: msg.value}(
            address(this),
            DEST_CHAIN,
            addressToString(destContractAddress),
            payload,
            msg.sender
        );

        // Call Axelar Gateway
        gateway.callContract(
            DEST_CHAIN,
            addressToString(destContractAddress),
            payload
        );
    }

    // Helper function to convert address to string
    function addressToString(address _addr) internal pure returns (string memory) {
        bytes32 _bytes = bytes32(uint256(uint160(_addr)));
        bytes memory HEX = "0123456789abcdef";
        bytes memory result = new bytes(42);
        result[0] = '0';
        result[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            result[2 + i * 2] = HEX[uint8(_bytes[i + 12] >> 4)];
            result[3 + i * 2] = HEX[uint8(_bytes[i + 12] & 0x0f)];
        }
        return string(result);
    }
}