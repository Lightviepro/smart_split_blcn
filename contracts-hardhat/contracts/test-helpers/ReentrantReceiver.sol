// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ISmartSplit {
    function splitPayment(address[] calldata recipients, uint256[] calldata amounts) external payable;
}

/// @notice TEST HELPER ONLY — never deployed to Sepolia.
/// @dev    A malicious-looking recipient: when it receives ETH, it immediately tries to call
///         splitPayment again (re-entry), forwarding the ETH it just received to `reentryTarget`.
///         The nested call is wrapped in try/catch so we can record *how* it failed, while the
///         outer payment itself is allowed to complete. Documented behaviour: the re-entry is
///         rejected with ReentrantCall(), and the outer payment succeeds normally.
contract ReentrantReceiver {
    ISmartSplit public immutable smartSplit;
    address public immutable reentryTarget;

    bool public reentryAttempted;
    bool public reentryBlocked;
    bytes public reentryRevertData;

    constructor(address smartSplit_, address target_) {
        smartSplit = ISmartSplit(smartSplit_);
        reentryTarget = target_;
    }

    receive() external payable {
        reentryAttempted = true;

        address[] memory recipients = new address[](1);
        recipients[0] = reentryTarget;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = msg.value;

        try smartSplit.splitPayment{value: msg.value}(recipients, amounts) {
            reentryBlocked = false;
        } catch (bytes memory reason) {
            reentryBlocked = true;
            reentryRevertData = reason;
        }
    }
}
