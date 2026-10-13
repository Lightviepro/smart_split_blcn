// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract SmartSplit {
    uint256 public constant MAX_RECIPIENTS = 20;

    uint256 public paymentCount;

    bool private locked;

    event PaymentSplit(
        uint256 indexed paymentId,
        address indexed sender,
        address[] recipients,
        uint256[] amounts,
        uint256 total,
        uint256 timestamp
    );

    error NoRecipients();
    error TooManyRecipients(uint256 count, uint256 max);
    error LengthMismatch(uint256 recipients, uint256 amounts);
    error ZeroAddress(uint256 index);
    error ContractAsRecipient(uint256 index);
    error SenderAsRecipient(uint256 index);
    error ZeroAmount(uint256 index);
    error DuplicateRecipient(address recipient);
    error IncorrectValue(uint256 sent, uint256 required);
    error ReentrantCall();
    error TransferFailed(address recipient, uint256 amount);
    error DirectPaymentNotAccepted();

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    function splitPayment(address[] calldata recipients, uint256[] calldata amounts)
        external
        payable
        nonReentrant
    {
        uint256 count = recipients.length;

        if (count == 0) revert NoRecipients();
        if (count > MAX_RECIPIENTS) revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length) revert LengthMismatch(count, amounts.length);

        uint256 required = 0;
        for (uint256 i = 0; i < count; i++) {
            address recipient = recipients[i];

            if (recipient == address(0)) revert ZeroAddress(i);
            if (recipient == address(this)) revert ContractAsRecipient(i);
            if (recipient == msg.sender) revert SenderAsRecipient(i);
            if (amounts[i] == 0) revert ZeroAmount(i);

            for (uint256 j = 0; j < i; j++) {
                if (recipients[j] == recipient) revert DuplicateRecipient(recipient);
            }

            required += amounts[i];
        }

        if (msg.value != required) revert IncorrectValue(msg.value, required);

        uint256 paymentId = ++paymentCount;

        for (uint256 i = 0; i < count; i++) {
            (bool ok, ) = recipients[i].call{value: amounts[i]}("");
            if (!ok) revert TransferFailed(recipients[i], amounts[i]);
        }

        emit PaymentSplit(paymentId, msg.sender, recipients, amounts, msg.value, block.timestamp);
    }

    receive() external payable {
        revert DirectPaymentNotAccepted();
    }

    fallback() external payable {
        revert DirectPaymentNotAccepted();
    }
}
