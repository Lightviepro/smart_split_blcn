// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title  SmartSplit — split one ETH payment among several recipients in a single transaction
/// @author Smart Split Blockchain Lab project
/// @notice Send ETH once, and this contract forwards the exact amount you chose to each
///         recipient inside the same transaction. Either *every* recipient is paid, or the
///         whole transaction reverts and nobody is paid (the sender keeps their ETH, minus gas).
/// @dev    Design summary (the "why" behind this file):
///         - PUSH payments: the contract sends ETH to recipients immediately. No balances are
///           stored, so there is nothing to withdraw later and nothing to steal.
///         - EXACT VALUE: msg.value must equal the sum of the amounts. Not ">=", but "==".
///           That guarantees the contract never keeps leftover ETH.
///         - CHECKS -> EFFECTS -> INTERACTIONS: validate everything first, update our own
///           state second, and only then talk to outside addresses.
///         - ALL-OR-NOTHING: if any single transfer fails, we revert. In the EVM a revert undoes
///           every change made by the transaction, including the transfers already made.
///         - No imports (not even OpenZeppelin) so this file compiles in Remix when pasted alone.
///         - No owner, no admin, no fees, no upgrade proxy: nobody has special powers here.
contract SmartSplit {
    // ---------------------------------------------------------------------
    // Constants and state
    // ---------------------------------------------------------------------

    /// @notice Maximum number of recipients in one payment.
    /// @dev    Gas cost grows linearly with the number of recipients (one external call each,
    ///         plus the O(n^2) duplicate check). A cap keeps every payment far below the block
    ///         gas limit and makes the duplicate check cheap. 20 is plenty for splitting a bill.
    uint256 public constant MAX_RECIPIENTS = 20;

    /// @notice Number of successful split payments so far. Also used as the payment ID.
    /// @dev    The first payment gets ID 1. If a payment reverts, the increment is undone too,
    ///         so IDs are always consecutive and every ID corresponds to a real, completed payment.
    uint256 public paymentCount;

    /// @dev Reentrancy lock. `true` only while splitPayment is running.
    ///      Hand-written instead of OpenZeppelin's ReentrancyGuard so Remix needs no imports.
    bool private locked;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @notice Emitted once for every successful split. The frontend builds its history from
    ///         these events — the blockchain itself is our database, no backend server needed.
    /// @dev    `paymentId` and `sender` are `indexed`, so a client can cheaply filter logs, for
    ///         example "only payments sent by my address". Arrays cannot be usefully indexed,
    ///         so recipients and amounts are stored in the event's data section.
    /// @param paymentId  Sequential ID of this payment (equals paymentCount after the payment).
    /// @param sender     Who paid.
    /// @param recipients Who received ETH, in the same order as `amounts`.
    /// @param amounts    How much each recipient received, in wei.
    /// @param total      Sum of all amounts (equals msg.value).
    /// @param timestamp  Block timestamp of the payment.
    event PaymentSplit(
        uint256 indexed paymentId,
        address indexed sender,
        address[] recipients,
        uint256[] amounts,
        uint256 total,
        uint256 timestamp
    );

    // ---------------------------------------------------------------------
    // Custom errors
    // ---------------------------------------------------------------------
    // Custom errors are cheaper than revert strings (only a 4-byte selector + arguments are
    // stored in the bytecode/returned) and they carry structured data, e.g. *which* index was
    // wrong. The frontend decodes them with the ABI and shows a plain-English message.

    /// @notice The recipients list is empty.
    error NoRecipients();
    /// @notice More than MAX_RECIPIENTS recipients were given.
    error TooManyRecipients(uint256 count, uint256 max);
    /// @notice recipients[] and amounts[] have different lengths.
    error LengthMismatch(uint256 recipients, uint256 amounts);
    /// @notice recipients[index] is the zero address (ETH sent there is burned forever).
    error ZeroAddress(uint256 index);
    /// @notice recipients[index] is this contract itself (it would bounce: receive() reverts).
    error ContractAsRecipient(uint256 index);
    /// @notice recipients[index] is the sender (paying yourself is pointless and likely a mistake).
    error SenderAsRecipient(uint256 index);
    /// @notice amounts[index] is zero.
    error ZeroAmount(uint256 index);
    /// @notice The same recipient appears more than once (likely a copy-paste mistake).
    error DuplicateRecipient(address recipient);
    /// @notice msg.value does not exactly equal the sum of the amounts.
    error IncorrectValue(uint256 sent, uint256 required);
    /// @notice splitPayment was called again while it was already running.
    error ReentrantCall();
    /// @notice Sending ETH to `recipient` failed (it reverted or ran out of gas).
    error TransferFailed(address recipient, uint256 amount);
    /// @notice ETH was sent directly to the contract instead of through splitPayment.
    error DirectPaymentNotAccepted();

    // ---------------------------------------------------------------------
    // Modifier
    // ---------------------------------------------------------------------

    /// @dev Simple reentrancy guard. While splitPayment runs, `locked` is true; any attempt by a
    ///      recipient to call splitPayment again (from inside its receive function) hits this
    ///      check and reverts. After the function body finishes, the lock is released.
    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    // ---------------------------------------------------------------------
    // Main function
    // ---------------------------------------------------------------------

    /// @notice Split the ETH sent with this call among `recipients`.
    /// @dev    `recipients[i]` receives `amounts[i]` wei. `msg.value` must equal the sum of
    ///         `amounts` exactly. Arrays are `calldata` (read-only, not copied to memory), which
    ///         is the cheapest location for external function inputs.
    ///
    ///         Why reentrancy is doubly safe here:
    ///         1. The contract never holds a balance between transactions, and each call must
    ///            bring its own exact ETH, so a re-entering recipient has nothing to drain.
    ///         2. Even so, the nonReentrant lock rejects any nested call outright.
    /// @param recipients Addresses to pay (1..MAX_RECIPIENTS, unique, not zero/self/contract).
    /// @param amounts    Wei to send to each recipient (each > 0), same length as recipients.
    function splitPayment(address[] calldata recipients, uint256[] calldata amounts)
        external
        payable
        nonReentrant
    {
        // ---------------- 1. CHECKS ----------------
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

            // Duplicate check: compare with every earlier recipient. This is O(n^2), which is
            // normally a red flag on-chain — but n is capped at 20, so at most 190 cheap
            // comparisons. That is simpler and cheaper than a mapping (which would need storage
            // writes and cleanup) or requiring the caller to pre-sort the addresses.
            for (uint256 j = 0; j < i; j++) {
                if (recipients[j] == recipient) revert DuplicateRecipient(recipient);
            }

            // Solidity >=0.8 checks overflow automatically: an absurdly large sum reverts.
            required += amounts[i];
        }

        // Exact equality, not >=. If we accepted more than required, the extra ETH would be
        // stuck in this contract forever (there is no withdraw function and no owner).
        if (msg.value != required) revert IncorrectValue(msg.value, required);

        // ---------------- 2. EFFECTS ----------------
        // Update our own state before calling any outside address.
        uint256 paymentId = ++paymentCount;

        // ---------------- 3. INTERACTIONS ----------------
        for (uint256 i = 0; i < count; i++) {
            // We use low-level `call` instead of `transfer` or `send`:
            // `transfer`/`send` forward only 2300 gas, which is not enough for many smart-contract
            // wallets (e.g. multisigs) whose receive function does some work. `call` forwards
            // all remaining gas. The risk of forwarding gas is reentrancy, which the lock and the
            // zero-balance design above already handle.
            (bool ok, ) = recipients[i].call{value: amounts[i]}("");

            // All-or-nothing: one failed transfer reverts the entire transaction, which also
            // undoes the transfers that already succeeded and the paymentCount increment.
            if (!ok) revert TransferFailed(recipients[i], amounts[i]);
        }

        emit PaymentSplit(paymentId, msg.sender, recipients, amounts, msg.value, block.timestamp);
        // The lock is released by the nonReentrant modifier after this line.
    }

    // ---------------------------------------------------------------------
    // Reject plain ETH transfers
    // ---------------------------------------------------------------------

    /// @notice Plain ETH transfers (no function call) are rejected.
    /// @dev    Without this, someone could accidentally send ETH here and it would be stuck
    ///         forever. Always use splitPayment.
    receive() external payable {
        revert DirectPaymentNotAccepted();
    }

    /// @notice Calls with unknown function data are rejected (and so is any ETH attached).
    fallback() external payable {
        revert DirectPaymentNotAccepted();
    }
}
