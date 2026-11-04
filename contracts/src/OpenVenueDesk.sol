// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OpenVenueDesk
/// @notice On-chain desk ledger + native fee sink for OpenVenue on Monad.
/// @dev Records compare/execute notes and trade intents; owner can withdraw fees.
contract OpenVenueDesk {
    address public owner;
    uint256 public noteCount;
    uint256 public tradeCount;
    string public constant VERSION = "OpenVenueDesk/1.0.0";

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Noted(
        address indexed who,
        uint256 indexed id,
        bytes32 indexed tag,
        string memo
    );
    event TradeRecorded(
        address indexed trader,
        uint256 indexed id,
        bytes32 ticker,
        bytes32 venue,
        uint8 side,
        uint256 amountUsdc
    );
    event FeeReceived(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error ZeroAddress();
    error InsufficientBalance();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Append a cheap on-chain note (used for desk heartbeats / audits).
    function note(bytes32 tag, string calldata memo) external returns (uint256 id) {
        id = ++noteCount;
        emit Noted(msg.sender, id, tag, memo);
    }

    /// @notice Record a trade intent after OpenVenue resolves a venue.
    /// @param side 0 = buy, 1 = sell
    function recordTrade(
        bytes32 ticker,
        bytes32 venue,
        uint8 side,
        uint256 amountUsdc
    ) external returns (uint256 id) {
        id = ++tradeCount;
        emit TradeRecorded(msg.sender, id, ticker, venue, side, amountUsdc);
    }

    /// @notice Accept native MON platform fees.
    receive() external payable {
        emit FeeReceived(msg.sender, msg.value);
    }

    function depositFee() external payable {
        emit FeeReceived(msg.sender, msg.value);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (address(this).balance < amount) revert InsufficientBalance();
        emit Withdrawn(to, amount);
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
