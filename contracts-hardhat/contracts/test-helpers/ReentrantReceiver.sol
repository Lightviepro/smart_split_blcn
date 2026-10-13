// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ISmartSplit {
    function splitPayment(address[] calldata recipients, uint256[] calldata amounts) external payable;
}

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
