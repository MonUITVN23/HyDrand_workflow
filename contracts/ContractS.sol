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
    
    // FIX: Axelar testnet uses "polygon-sepolia" for Amoy (chainId 80002)
    string public constant DEST_CHAIN = "polygon-sepolia";
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
        require(_gatewayAddress != address(0), "Invalid gateway");
        require(_gasServiceAddress != address(0), "Invalid gas service");
        require(_destContractAddress != address(0), "Invalid dest contract");
        
        gateway = IAxelarGateway(_gatewayAddress);
        gasService = IAxelarGasService(_gasServiceAddress);
        destContractAddress = _destContractAddress;
    }

    function RequestRandomness(uint256 _sessionId) external {
        require(_sessionId > 0, "Invalid session ID");
        currentSessionId = _sessionId;
        emit RandomnessRequested(_sessionId);
    }

    function SubmitCommitment(bytes32 _commitment) external payable {
        require(currentSessionId > 0, "No active session");
        require(_commitment != bytes32(0), "Invalid commitment");
        require(msg.value > 0, "Must send gas payment");
        
        currentCommitment = _commitment;
        emit CommitmentSubmitted(currentSessionId, _commitment);

        string memory destAddressStr = _toAddressString(destContractAddress);

        // Axelar GMP payload - just encode the data, no function signature
        bytes memory payload = abi.encode(currentSessionId, _commitment);

        // Pay gas first
        gasService.payNativeGasForContractCall{value: msg.value}(
            address(this),
            DEST_CHAIN,
            destAddressStr,
            payload,
            msg.sender
        );

        // Then call contract
        gateway.callContract(
            DEST_CHAIN,
            destAddressStr,
            payload
        );
    }

    function _toAddressString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
}