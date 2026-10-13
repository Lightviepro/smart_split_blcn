// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice TEST HELPER ONLY — never deployed to Sepolia.
/// @dev    Simulates a smart-contract wallet whose receive() does real work: it writes to
///         storage (a fresh SSTORE costs ~20,000 gas, far above the 2,300-gas stipend that
///         `transfer`/`send` forward). SmartSplit uses `call`, so this recipient still gets paid.
contract GasHeavyReceiver {
    uint256 public timesPaid;
    uint256 public totalReceived;

    receive() external payable {
        timesPaid += 1;
        totalReceived += msg.value;
    }
}

/// @notice TEST HELPER ONLY — pays a recipient with Solidity's `transfer` (2300-gas stipend).
/// @dev    Used to demonstrate that `transfer` would FAIL to pay GasHeavyReceiver, which is
///         exactly why SmartSplit uses `call` instead.
contract TransferSender {
    function payWithTransfer(address payable to) external payable {
        to.transfer(msg.value);
    }
}
