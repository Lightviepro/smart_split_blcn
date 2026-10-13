// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice TEST HELPER ONLY — never deployed to Sepolia.
/// @dev    A recipient that refuses all ETH. Used to prove that one failing transfer reverts
///         the whole split (atomicity) with SmartSplit.TransferFailed.
contract RejectingReceiver {
    receive() external payable {
        revert("RejectingReceiver: no ETH accepted");
    }
}
