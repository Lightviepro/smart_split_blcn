# Viva preparation — Smart Split

Short answers you can say out loud, grouped by topic. Numbers come from [TEST_RESULTS.md](TEST_RESULTS.md).

---

## A. Blockchain basics

**1. What is a blockchain?**
A shared database (a *ledger*) copied on thousands of computers (*nodes*). Data is grouped into blocks, and each block contains the hash of the previous one, so changing old data would break every later block. Nodes agree on the next block by a *consensus* rule, so no single party controls it.

**2. What does "decentralised" mean for this project?**
No company runs Smart Split's backend. The contract's code and the payment history live on Ethereum, on every node. Even I, the developer, cannot change the rules after deployment or take anyone's funds.

**3. What is a transaction? What is a block?**
A transaction is a signed instruction from an account, for example "call `splitPayment` with these arguments and attach 0.003 ETH". A block is a batch of transactions that the network adds to the chain together. On Ethereum a new block arrives about every 12 seconds.

**4. What is a hash, and why does it matter here?**
A hash is a fixed-length fingerprint of data: any small change gives a completely different hash. Transactions are identified by their hash. That is the "tx hash" the app shows and links to on Etherscan.

**5. What is a smart contract?**
A program stored on the blockchain at an address. Anyone can call it, and every node runs it in the same way (the EVM), so the result is the same everywhere. Once deployed, its code cannot be changed. SmartSplit is a smart contract.

## B. Ethereum, gas and testnets

**6. What is gas? Who pays it?**
Gas measures how much computation a transaction uses. The sender pays `gasUsed × gasPrice` in ETH to the network. Gas stops infinite loops and makes spam expensive. In our project the sender pays the gas; recipients pay nothing.

**7. How much gas does a split cost?**
Measured: about **51,900 gas for 1 recipient, 70,900 for 3, 161,900 for 10, 321,900 for 20** (when recipients already exist). Cost grows **roughly linearly**: about 10k gas per extra recipient for small payments, rising to about 16k at 20 recipients, because the duplicate check and the calldata/event data grow too. Paying a brand-new empty address costs an extra 25,000 gas (EVM account-creation charge). Deployment cost 426,320 gas. **These are local-chain (`cancun`) numbers.** On Sepolia, whose newer upgrade (6 Oct 2026) prices state creation higher, deployment cost 2,875,494 gas (0.0043 test ETH) and estimates are about 449k gas for 1 new recipient and 852k for 3. Same code; the network's gas prices per operation changed.

**8. Why is splitting in one transaction better than sending N separate transfers?**
(1) The user approves **one** MetaMask popup instead of N. (2) It is **atomic**: either everyone gets paid or no one does, so it can never stop half-way. (3) Each transaction has a fixed 21,000-gas base cost; one transaction pays it once instead of N times. (4) One event records the whole payment for history.

**9. What is a testnet? Why Sepolia?**
A public Ethereum network that works exactly like mainnet but whose ETH has no value (free from faucets). Sepolia is the recommended, maintained Ethereum testnet. We develop on a local Hardhat chain (instant, free, resettable) and demo on Sepolia (public, visible on Etherscan).

**10. What is a chain ID?**
A number that identifies a network: Sepolia = 11155111, Hardhat local = 31337, mainnet = 1. It is included in every signed transaction (EIP-155), so a transaction signed for one network can't be replayed on another. The app checks the chain ID and offers "Switch to Sepolia" otherwise.

**11. What is Etherscan?**
A block explorer: a website that reads the blockchain and displays transactions, addresses, contracts and event logs. For a payment we can show the transaction, the **internal transactions** (the contract paying each recipient) and the **logs** (the `PaymentSplit` event).

## C. Solidity specifics

**12. What does `payable` mean?**
A function marked `payable` can receive ETH with the call. `splitPayment` is payable because the user sends the total with it. A non-payable function rejects any ETH automatically.

**13. What are `msg.sender` and `msg.value`?**
`msg.sender` is the address that called the function (our *sender*). `msg.value` is the amount of wei sent with the call. We require `msg.value == sum(amounts)` exactly, and we reject `msg.sender` as a recipient.

**14. Why `calldata` for the array parameters?**
`calldata` is the read-only area where function arguments arrive. Reading it directly avoids copying arrays into `memory`, which saves gas. We never modify the arrays, so `calldata` is the right choice for an `external` function.

**15. What is an event and why use one?**
An event is a log entry written by a transaction. It is cheap compared with storage, and contracts can't read it back, but off-chain apps can query it efficiently, filtered by `indexed` fields. `PaymentSplit` has `paymentId` and `sender` indexed, so "My payments" asks the node only for events where `sender` = my address.

**16. What are custom errors? Why not `require(cond, "message")`?**
`error ZeroAmount(uint256 index);` + `revert ZeroAmount(i);`. Compared with revert strings, they are cheaper (a 4-byte selector instead of a stored string) and they carry **data**, such as which index was wrong. The frontend decodes them with the ABI and shows plain English, e.g. "Recipient #3 has an amount of 0."

**17. `call` vs `transfer` vs `send`: which did you use and why?**
`transfer` and `send` forward only **2,300 gas**, which is not enough for smart-contract wallets (like a multisig) whose `receive()` does any real work; payments to them would fail. `call{value: x}("")` forwards all remaining gas and returns `true`/`false`, which we check (`if (!ok) revert TransferFailed(...)`). A test proves it: `GasHeavyReceiver` (which writes to storage on receive) is paid by SmartSplit but **cannot** be paid by a contract using `transfer`. The risk of forwarding gas is reentrancy, which we handle (Q19).

**18. What do `receive()` and `fallback()` do in your contract?**
`receive()` runs when someone sends plain ETH with no data; `fallback()` runs for unknown function calls. Both **revert** with `DirectPaymentNotAccepted()`. Otherwise ETH sent by mistake would be stuck forever, since the contract has no withdraw function.

## D. Security

**19. What is reentrancy and how is SmartSplit protected?**
Reentrancy is when a contract we call (a recipient) calls back into our function before the first call finished, hoping to act on a half-updated state (the 2016 DAO hack). Protection is double:
1. **Nothing to steal:** the contract never holds a balance, and every call must bring its own exact ETH.
2. **Lock:** a hand-written `nonReentrant` modifier sets `locked = true` while `splitPayment` runs, and a nested call reverts with `ReentrantCall()`.
A test uses `ReentrantReceiver`, which tries to re-enter from `receive()`. The re-entry is rejected with `ReentrantCall`, the attacker's target gets nothing, and `paymentCount` rises by only 1.

**20. What is Checks-Effects-Interactions (CEI)?**
An ordering rule: first **check** all conditions, then update your own **state** (effects), and only then **interact** with external addresses. In SmartSplit: validation → `paymentId = ++paymentCount` → the loop of `call`s → emit the event. If an external call re-enters, our state is already final.

**21. Why must `msg.value` be *exactly* equal to the sum, not `>=`?**
With `>=`, any extra ETH would stay inside the contract forever, because there is no owner and no withdraw function. Exact equality guarantees the contract balance is always 0. Tests cover too low, too high and zero values (`IncorrectValue(sent, required)`).

**22. What happens if one recipient can't receive ETH?**
Its `call` returns false, and we `revert TransferFailed(recipient, amount)`. A revert undoes **everything** in the transaction, including transfers already made to earlier recipients and the `paymentCount` increment. The sender keeps their ETH and pays only gas. Our test puts a rejecting contract **in the middle** and checks that no balance changed. In the app, the pre-send simulation catches this, so MetaMask doesn't even open.

**23. Push vs pull payments: what's the difference and why push?**
*Push*: the contract sends ETH to recipients immediately (ours). *Pull*: the contract records balances, and each recipient later calls `withdraw()`. Pull is more robust, since one bad recipient can't block the others, but it needs storage, a second transaction per recipient, and it holds funds (a bigger attack surface). For a bill-splitting demo where recipients are normal wallets, push + all-or-nothing is simpler and holds no funds. Pull is listed as future scope.

**24. Why reject duplicates, the zero address, the contract itself and the sender?**
They are almost always mistakes. Zero address: ETH would be burned forever. The contract itself: its `receive()` reverts anyway. The sender: paying yourself wastes gas. Duplicates: usually a copy-paste error, and they make the split ambiguous. The UI catches all of them before sending, and the contract enforces them again, because the contract can be called directly (e.g. from Remix).

**25. How does the duplicate check work, and isn't O(n²) bad?**
For each recipient we compare it with all earlier ones: at most 20×19/2 = **190 comparisons** of values already in calldata, which is cheap. A mapping would need storage writes (~20k gas each) plus cleanup. O(n²) is only a problem for large n, and the cap of 20 keeps it small.

**26. How do you stop someone from paying the wrong address?**
(1) Live validation, including the **EIP-55 checksum**: a mixed-case address with a typo fails the checksum. (2) A **review modal** with every full address, amount, network and contract address. (3) A required checkbox, "I have checked the recipient addresses". (4) MetaMask's own confirmation. Blockchain payments can't be reversed, so the checks must happen before sending.

## E. This project's design choices

**27. Why is there no backend server or database?**
The smart contract *is* the backend: its rules run on Ethereum. The **event log is the database**: every payment emits `PaymentSplit`, which is permanent and public. The frontend reads it with `queryFilter`. With no server there is nothing to host or hack, and no user data to protect.

**28. Why read history from events rather than storing it in the contract?**
Contract storage is expensive (~20,000 gas per new 32-byte slot), and storing recipient arrays would multiply the cost of every payment. Events cost a fraction of that and are designed for off-chain reading. Since only the frontend needs the history, not the contract, events are the right tool.

**29. Why load history in block chunks?**
`eth_getLogs` over millions of blocks is refused by many RPC providers ("block range too large"). The app starts at the deployment block and asks for 5,000 blocks at a time. If the provider still complains, it halves the range and retries. This is unit-tested in `chunks.test.ts`.

**30. Why the 20-recipient cap?**
It bounds gas: the worst case of 20 brand-new recipients is about 822k gas locally and about 4.3M on Sepolia, far below the block gas limit (200M on Sepolia), so a payment can never be too big to fit in a block. It also keeps the O(n²) duplicate check trivial, and 20 is more than enough for splitting a bill.

**31. Why `bigint` and wei in the frontend instead of normal numbers?**
JavaScript numbers are floating-point: `0.1 + 0.2 = 0.30000000000000004`, and they lose precision above 2⁵³. ETH has 18 decimals. So every amount is a `bigint` in wei, parsed only with `ethers.parseEther`. The equal split uses integer division, and the remainder (a few wei) goes to the first recipients, so the parts always add up exactly. Example: 0.1 ETH / 7 → five recipients get …286 wei, two get …285 wei.

**32. What are the roles of Hardhat and Remix?**
**Hardhat** is the engineering tool: compile, 30 automated tests, coverage (100% lines), gas report, deploy scripts, ABI export. **Remix** is the visual tool: compile and deploy in the browser, show a call and its event live, deploy to Sepolia through MetaMask, and use "At Address" to interact with the live contract. Both use solc 0.8.28 with optimizer 200, and we verified the executable bytecode is identical.

**33. How does MetaMask sign without sharing the private key?**
The private key never leaves MetaMask. The app builds the *unsigned* transaction and asks MetaMask via `window.ethereum` (EIP-1193). MetaMask shows it to the user, signs it **inside the extension** with the key, and broadcasts it. The app only receives the transaction hash. A signature proves the key holder approved the transaction without revealing the key (public-key cryptography, ECDSA).

**34. Why is there no owner or admin?**
An admin is a risk: if their key leaks, or they act badly, users suffer. SmartSplit doesn't need one, because it has no settings, no fees and holds no funds. With no admin there is nothing to trust except the published code.

**35. How do you know a payment is really confirmed?**
The app shows "Confirmed" only after `tx.wait(1)` returns a **receipt** with `status === 1`, meaning the transaction is in a block and succeeded. Before that it shows "Pending" with the hash. A rejected or reverted transaction is shown as such and never mixed into the on-chain history list.

## F. Testing

**36. How did you test the contract?**
**30 Hardhat tests** (Mocha/Chai + ethers): deployment state; successful splits with exact balance changes (1, 3, unequal, exactly 20 recipients); the exact event arguments; every validation error with its arguments, including duplicates at non-adjacent positions; atomic failure with a rejecting recipient; reentrancy; direct ETH rejection; a smart-contract-wallet recipient; and gas for 1/3/10/20 recipients. Coverage of `SmartSplit.sol`: **100% lines and statements**.

**37. How did you test the frontend?**
**44 Vitest unit tests** for the pure logic (amount parsing, address/checksum validation, equal split, formatting, error decoding, chunked log loading), plus strict TypeScript, lint and a production build. An optional headless-Chrome smoke test drives the real UI against a local chain (26 checks). Finally, manual tests with real MetaMask on the local chain and on Sepolia.

**38. What is `demo:local`?**
A script that, on the local chain, splits 0.03 ETH among three accounts and prints the balances before and after. It verifies automatically that each recipient got exactly 0.01 ETH, that the sender paid exactly 0.03 ETH plus gas, and that the contract kept 0.

## G. Limitations and future work

**39. What are the limitations?**
At most 20 recipients. All-or-nothing means one bad recipient blocks the whole payment. Gas grows linearly with recipients. ETH only (no tokens). Testnet only. Labels are not saved anywhere. Everything is public on-chain (no privacy).

**40. What would you add next?**
The pull-payment pattern (withdraw), ERC-20 token splits, recurring/scheduled splits, and deployment on a Layer-2 network (much cheaper gas). Possibly saved address books (off-chain) and ENS names.
