// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract RejectingReceiver {
    receive() external payable {
        revert("RejectingReceiver: no ETH accepted");
    }
}
