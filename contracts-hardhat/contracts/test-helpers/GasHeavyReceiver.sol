// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract GasHeavyReceiver {
    uint256 public timesPaid;
    uint256 public totalReceived;

    receive() external payable {
        timesPaid += 1;
        totalReceived += msg.value;
    }
}

contract TransferSender {
    function payWithTransfer(address payable to) external payable {
        to.transfer(msg.value);
    }
}
