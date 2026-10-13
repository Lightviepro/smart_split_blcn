# Smart Split — Developer Guide

A beginner-friendly walk through the whole project: the ideas you need first, then every file and function, then how the pieces work together when someone uses the app.

Read it in order the first time. Links open the actual code.

**Contents**

1. [Concepts you need first](#1-concepts-you-need-first)
2. [Project map](#2-project-map)
3. [The smart contract](#3-the-smart-contract)
4. [The Hardhat project: config, tests, scripts](#4-the-hardhat-project)
5. [The frontend: setup and configuration](#5-the-frontend-setup-and-configuration)
6. [Frontend logic: `lib/`](#6-frontend-logic-lib)
7. [Frontend state: `hooks/`](#7-frontend-state-hooks)
8. [Frontend UI: `components/` and `App.tsx`](#8-frontend-ui-components-and-apptsx)
9. [End-to-end flows](#9-end-to-end-flows)
10. [Contract ↔ frontend cheat sheet](#10-contract--frontend-cheat-sheet)
11. [Check your understanding](#11-check-your-understanding)

---

## 1. Concepts you need first

**Account and address.** An Ethereum account is identified by a 42-character address such as `0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC`. A normal account (yours in MetaMask) is controlled by a **private key**. A **contract account** is controlled by its code.

**Wei.** ETH has 18 decimal places. The smallest unit is the wei: `1 ETH = 1,000,000,000,000,000,000 wei`. Contracts only ever work in wei. `0.01 ETH` is `10000000000000000` wei.

**Transaction.** A signed message from an account that changes the blockchain, for example "call `splitPayment` and attach 0.003 ETH". It gets a **hash** (its ID) as soon as it is sent, and is **confirmed** once it is included in a **block**.

**Gas.** Every operation a contract performs costs gas. The sender pays `gas used × gas price` in ETH. Reading data does not cost gas; changing data does.

**Smart contract.** A program deployed at an address. Its code cannot be changed after deployment. Anyone can call its functions.

**Revert.** If a contract hits a `revert`, everything the transaction did is undone, as if it never happened, except that the sender still pays for the gas used.

**Event.** A log entry a contract writes during a transaction. Contracts cannot read events, but apps can search them cheaply. Smart Split uses events as its payment history.

**ABI (Application Binary Interface).** A JSON description of a contract's functions, events and errors. The frontend needs it to know how to call the contract and decode its answers. Ours is [frontend/src/abi/SmartSplit.json](../frontend/src/abi/SmartSplit.json).

**Read vs write.**
- A **read** (a `view` function or public variable such as `paymentCount`) asks a node for data. It is free and instant, and MetaMask does not pop up.
- A **write** (such as `splitPayment`) is a transaction. It must be signed in MetaMask, costs gas, and takes a block (about 12 seconds on Sepolia) to confirm.

**Chain ID.** Identifies the network: Sepolia is `11155111`, the local Hardhat chain is `31337`, Ethereum mainnet is `1`.

**Provider and signer (ethers.js words).** A **provider** reads from the blockchain. A **signer** can also sign transactions. In the browser, both come from MetaMask (`window.ethereum`).

---

## 2. Project map

```
blcnProj/
├── contracts-hardhat/                 everything about the smart contract
│   ├── contracts/SmartSplit.sol       the contract
│   ├── contracts/test-helpers/        small contracts used only in tests
│   ├── test/SmartSplit.test.ts        30 automated tests
│   ├── scripts/deploy.ts              deploy + tell the frontend where the contract is
│   ├── scripts/export-abi.ts          tell the frontend about a contract deployed elsewhere (Remix)
│   ├── scripts/demo-local.ts          scripted payment on the local chain
│   ├── scripts/lib/frontend-sync.ts   shared helpers for the two scripts above
│   ├── deployments/                   records of deployments (sepolia.json, localhost.json)
│   └── hardhat.config.ts              compiler and network settings
├── frontend/                          the website
│   ├── src/main.tsx                   starts React
│   ├── src/App.tsx                    the page: holds the form state and wires everything together
│   ├── src/config/                    which contract address to use on which chain
│   ├── src/abi/SmartSplit.json        the contract's ABI
│   ├── src/lib/                       pure logic (no React): validation, maths, formatting, errors
│   ├── src/hooks/                     React hooks: wallet, contract calls, history
│   └── src/components/                the visible pieces of the page
├── remix/REMIX_GUIDE.md               how to use Remix with this contract
└── docs/                              report, viva notes, test results, this guide
```

**How the layers depend on each other** (arrows mean "uses"):

```
components  →  hooks  →  lib  →  ethers.js
     ↑            ↓
   App.tsx     config (address + ABI)  →  MetaMask  →  SmartSplit contract
```

`lib/` never imports React, which makes it easy to unit-test. `hooks/` hold the changing data (state). `components/` only display data and report clicks.

---

## 3. The smart contract

File: [contracts-hardhat/contracts/SmartSplit.sol](../contracts-hardhat/contracts/SmartSplit.sol)

### 3.1 Header

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
```

- The **SPDX line** declares the license. The compiler warns if it is missing.
- **`pragma`** pins the exact compiler version. Hardhat and Remix both use 0.8.28, so they produce the same code. Since Solidity 0.8, arithmetic overflow automatically reverts, so `required += amounts[i]` cannot silently wrap around.

### 3.2 State variables

```solidity
uint256 public constant MAX_RECIPIENTS = 20;
uint256 public paymentCount;
bool private locked;
```

| Variable | What it is | Why |
|---|---|---|
| `MAX_RECIPIENTS` | A `constant`, baked into the code, not stored | Caps the work per payment, so gas stays bounded and the duplicate check stays cheap |
| `paymentCount` | Stored number, starts at 0 | Counts successful payments and gives each one an ID. `public` makes Solidity create a free read function `paymentCount()` automatically |
| `locked` | Stored true/false | The reentrancy lock (section 3.5). `private` means no automatic read function |

### 3.3 The event

```solidity
event PaymentSplit(
    uint256 indexed paymentId,
    address indexed sender,
    address[] recipients,
    uint256[] amounts,
    uint256 total,
    uint256 timestamp
);
```

Emitted once per successful payment. **`indexed`** fields can be used as search filters. That is how "My payments" asks the network only for events where `sender` is your address.

### 3.4 Custom errors

```solidity
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
```

`revert ZeroAmount(2);` stops the transaction and returns the error name plus its data. Compared with `require(cond, "text")` it is cheaper and carries structured details, such as *which* recipient was wrong. The frontend decodes these in [errors.ts](../frontend/src/lib/errors.ts) (section 6.5).

### 3.5 The `nonReentrant` modifier

```solidity
modifier nonReentrant() {
    if (locked) revert ReentrantCall();
    locked = true;
    _;
    locked = false;
}
```

A **modifier** wraps a function. `_;` is where the function's own code runs.

**The problem it solves:** when the contract sends ETH to a recipient that is itself a contract, that contract's code runs. A malicious one could call `splitPayment` again *before the first call has finished* (this is called **reentrancy**). With the lock, any nested call finds `locked == true` and reverts.

### 3.6 `splitPayment`: the main function

```solidity
function splitPayment(address[] calldata recipients, uint256[] calldata amounts)
    external
    payable
    nonReentrant
```

- `external`: called from outside (MetaMask, Remix, other contracts).
- `payable`: the call may carry ETH. The amount is available as `msg.value`.
- `calldata`: the arrays are read directly from the transaction input, without copying. This is the cheapest option for inputs that are not modified.
- `nonReentrant`: wrapped by the lock above.

The body follows the **Checks → Effects → Interactions** pattern.

**1. Checks: validate everything first**

```solidity
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
```

- `address(0)` is the zero address. ETH sent there is lost forever.
- `address(this)` is the contract's own address, which would just bounce (see 3.7).
- `msg.sender` is whoever called the function. Paying yourself is pointless.
- The inner loop compares each recipient with every earlier one: at most 20 × 19 / 2 = 190 comparisons, which is cheap.
- `msg.value` must **exactly** equal the sum. If more were allowed, the extra would be stuck in the contract forever, since there is no withdraw function.

**2. Effects: update our own state**

```solidity
uint256 paymentId = ++paymentCount;
```

`++paymentCount` adds 1 and returns the new value, so the first payment gets ID 1. State is updated *before* any ETH leaves the contract.

**3. Interactions: send the money**

```solidity
for (uint256 i = 0; i < count; i++) {
    (bool ok, ) = recipients[i].call{value: amounts[i]}("");
    if (!ok) revert TransferFailed(recipients[i], amounts[i]);
}
```

- `.call{value: x}("")` sends `x` wei with no function data and returns `ok = true/false`.
- It is used instead of `.transfer(x)` because `transfer` only gives the receiver 2,300 gas, which is too little for smart-contract wallets.
- If any send fails, `revert` undoes **all** the earlier sends in this transaction, and `paymentCount` goes back down. Either everyone is paid or nobody is.

**4. Record it**

```solidity
emit PaymentSplit(paymentId, msg.sender, recipients, amounts, msg.value, block.timestamp);
```

`block.timestamp` is the time of the block, in seconds since 1970. After this line the modifier sets `locked = false`.

### 3.7 `receive` and `fallback`

```solidity
receive() external payable { revert DirectPaymentNotAccepted(); }
fallback() external payable { revert DirectPaymentNotAccepted(); }
```

- `receive` runs when someone sends plain ETH to the contract.
- `fallback` runs when someone calls a function that does not exist.

Both refuse, so ETH can never get stuck in the contract by accident.

### 3.8 Properties worth remembering

- The contract's balance is always 0. It forwards everything within the same transaction.
- It has no owner, no admin and no fees. Nobody can change its rules.
- Every successful payment increases `paymentCount` by exactly 1 and emits exactly one `PaymentSplit` event.

### 3.9 Test helper contracts

These live in [contracts/test-helpers/](../contracts-hardhat/contracts/test-helpers/) and are only deployed inside tests.

| Contract | Behaviour | Used to prove |
|---|---|---|
| `RejectingReceiver` | `receive()` always reverts | One failed transfer reverts the whole payment |
| `ReentrantReceiver` | `receive()` tries to call `splitPayment` again and records whether it was blocked | The reentrancy lock works |
| `GasHeavyReceiver` | `receive()` writes to storage, which needs more than 2,300 gas | `call` can pay smart-contract wallets |
| `TransferSender` | Pays using `transfer` | `transfer` *fails* for `GasHeavyReceiver`, which is why `call` is used |

---

## 4. The Hardhat project

### 4.1 [hardhat.config.ts](../contracts-hardhat/hardhat.config.ts)

- **Optional `.env`:** `process.loadEnvFile(".env")` loads `contracts-hardhat/.env` if it exists.
- **Compiler:** `SOLIDITY_SETTINGS` sets `0.8.28` with the optimizer on at 200 runs. These are the same settings you choose in Remix.
- **Networks:**
  - `default`: an in-memory blockchain created for each test run.
  - `localhost`: `npm run node` at `http://127.0.0.1:8545`.
  - `sepolia`: the public testnet. Its URL and private key come from `configVariable(...)`, which reads the encrypted Hardhat keystore or environment variables, so they are never written in code.
- **`verify`:** settings for Etherscan source verification (optional).

### 4.2 npm scripts ([package.json](../contracts-hardhat/package.json))

| Command | What it runs |
|---|---|
| `npm run compile` | Compile the contracts into `artifacts/` |
| `npm test` | All Mocha tests |
| `npm run coverage` | Tests plus a coverage report |
| `npm run gas` | Tests plus a gas usage table |
| `npm run node` | Start a local blockchain with 20 funded test accounts |
| `npm run deploy:local` / `deploy:sepolia` | `scripts/deploy.ts` on that network |
| `npm run export-abi` | Compile, then `scripts/export-abi.ts` |
| `npm run demo:local` | `scripts/demo-local.ts` on the local node |
| `npm run typecheck` | TypeScript check of the scripts and tests |

### 4.3 Tests: [test/SmartSplit.test.ts](../contracts-hardhat/test/SmartSplit.test.ts)

**Setup:**
- `await network.create()` gives a fresh in-memory blockchain, plus `ethers` and `networkHelpers`.
- **`makeAddresses(count)`** creates distinct addresses that have never held ETH.
- **`sum(values)`** adds up a list of bigints.
- **`deployFixture()`** deploys a new `SmartSplit` and returns it with five test accounts (`sender`, `alice`, `bob`, `carol`, `dave`).

**`networkHelpers.loadFixture(deployFixture)`** runs the fixture once, then snapshots the chain. Every later test restores that snapshot, so each test starts from the same clean state, quickly.

**Test groups:**

| `describe` block | What it checks |
|---|---|
| Deployment | `paymentCount` is 0, `MAX_RECIPIENTS` is 20, contract balance is 0 |
| Successful splits | 1 recipient, 3 equal, unequal amounts, exactly 20 recipients, exact event arguments, `paymentCount` increments, contract balance stays 0 |
| Validation reverts | Every custom error with its exact arguments, including duplicates far apart, and value too low/high/zero |
| Failed transfer (atomicity) | A rejecting recipient in the middle → `TransferFailed` and **no** balance changed |
| Reentrancy | The re-entry is blocked with `ReentrantCall`; only the outer payment counts |
| Direct ETH | Plain sends and unknown function calls revert with `DirectPaymentNotAccepted` |
| Smart-contract-wallet recipient | `GasHeavyReceiver` is paid; `transfer` fails for it |
| Gas sanity | Prints gas for 1, 3, 10 and 20 recipients |

**Useful matchers to recognise:**

```ts
await expect(tx).to.changeEtherBalances(ethers, [alice, bob], [amountA, amountB])
await expect(tx).to.be.revertedWithCustomError(smartSplit, "ZeroAmount").withArgs(1n)
await expect(tx).to.emit(smartSplit, "PaymentSplit").withArgs(...)
```

Numbers ending in `n` (like `1n`) are JavaScript **bigints**, which are exact whole numbers of any size. Wei values must be bigints.

### 4.4 Shared helpers: [scripts/lib/frontend-sync.ts](../contracts-hardhat/scripts/lib/frontend-sync.ts)

| Function | What it does |
|---|---|
| `HARDHAT_ROOT`, `FRONTEND_ROOT` | Absolute paths to the two project folders, so the scripts work from any directory |
| `exportAbi()` | Reads `artifacts/contracts/SmartSplit.sol/SmartSplit.json` (made by compiling), takes only the `abi` part and writes it to `frontend/src/abi/SmartSplit.json` |
| `readRegistrations()` | Reads the current `frontend/src/config/contracts.ts` and extracts every `chainId: { address, deployBlock }` line with a regular expression |
| `registerContract({ chainId, address, deployBlock })` | Adds or replaces the entry for one chain, keeps the others, sorts by chain ID, and rewrites `contracts.ts` |

### 4.5 [scripts/deploy.ts](../contracts-hardhat/scripts/deploy.ts)

1. `network.getOrCreate()` connects to the network named with `--network`.
2. Prints the deployer address and balance.
3. `ethers.deployContract("SmartSplit")` sends the deployment transaction.
4. `deployTx.wait(1 or 2)` waits for 1 confirmation locally, 2 on Sepolia.
5. Writes `deployments/<network>.json` with the address, deployer, tx hash, block, gas and time.
6. Calls `exportAbi()` and `registerContract(...)`, so the frontend immediately knows the new address.

### 4.6 [scripts/export-abi.ts](../contracts-hardhat/scripts/export-abi.ts)

Used after deploying **from Remix**, where `deploy.ts` didn't run:

```bash
npm run export-abi -- --address 0x3Ff9... --block 11904281 --chain 11155111
```

1. `parseArgs` reads `--address`, `--block` and `--chain`.
2. `exportAbi()` always runs.
3. With no arguments, it only prints the current registrations.
4. With all three arguments, it checks the address format, that the block is a whole number, and that the chain is 11155111 or 31337, then calls `registerContract`.

### 4.7 [scripts/demo-local.ts](../contracts-hardhat/scripts/demo-local.ts)

1. Reads `deployments/localhost.json` to find the contract, and checks there is code at that address.
2. Splits 0.03 ETH equally among test accounts #1, #2 and #3, using the same "first recipients get the extra wei" rule as the frontend.
3. **`balancesOf(addrs)`** reads every balance before and after; **`fmt(wei)`** formats wei as ETH.
4. Prints a table, reads the `PaymentSplit` event back from the receipt, and checks that:
   - each recipient gained exactly its share,
   - the sender lost exactly the total plus the gas fee,
   - the contract holds 0.

---

## 5. The frontend: setup and configuration

### 5.1 Tooling

| File | Role |
|---|---|
| [package.json](../frontend/package.json) | Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `preview`, `e2e:local` |
| [vite.config.ts](../frontend/vite.config.ts) | Enables React and Tailwind; tells Vitest where tests are |
| [tsconfig.app.json](../frontend/tsconfig.app.json) | TypeScript in `strict` mode |
| [index.html](../frontend/index.html) | The single HTML page; React fills `<div id="root">` |
| [src/index.css](../frontend/src/index.css) | Tailwind import, colour tokens, the lavender background and the `float` / `well` card styles |

### 5.2 [src/main.tsx](../frontend/src/main.tsx)

Loads the fonts and CSS, then `createRoot(...).render(<App />)` mounts the app into `#root`. `StrictMode` is a React development aid that double-runs some code to reveal bugs.

### 5.3 [src/vite-env.d.ts](../frontend/src/vite-env.d.ts)

TypeScript type definitions:
- `ImportMetaEnv` lists the optional environment variables (`VITE_ENABLE_LOCAL_CHAIN`, `VITE_LOG_CHUNK_SIZE`).
- `EthereumProvider` / `Window.ethereum` describe what MetaMask injects: a `request` method and `on` / `removeListener` for events.

### 5.4 [src/config/contracts.ts](../frontend/src/config/contracts.ts)

```ts
export const CONTRACTS: Record<number, ContractDeployment> = {
  31337: { address: "0x5FbD...", deployBlock: 1 },
  11155111: { address: "0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC", deployBlock: 11904281 },
};
```

This is where the frontend learns where the contract lives on each chain. `deployBlock` is where the history search starts; searching from block 0 would scan millions of empty blocks. The scripts write this file, and you can also edit it by hand.

### 5.5 [src/config/chains.ts](../frontend/src/config/chains.ts)

| Export | What it does |
|---|---|
| `LOCAL_CHAIN_ENABLED` | `true` in `npm run dev`, or when `VITE_ENABLE_LOCAL_CHAIN=true`. A production build is Sepolia-only |
| `SUPPORTED_CHAIN_IDS` | `[11155111]`, plus `31337` when the local chain is enabled |
| `LOG_CHUNK_SIZE` | Blocks per history request, default 5000 |
| `isSupportedChain(chainId)` | `true` if the app works on this chain |
| `getDeployment(chainId)` | Returns `{ address, deployBlock }` for a supported chain, otherwise `null` |
| `ADD_CHAIN_PARAMS` | Network details MetaMask needs if it must *add* a network (used for localhost) |

### 5.6 [src/lib/contract.ts](../frontend/src/lib/contract.ts)

- `SMART_SPLIT_ABI` is the imported JSON ABI.
- `SMART_SPLIT_INTERFACE = new Interface(abi)` is an ethers object that can encode calls and decode events and errors.

---

## 6. Frontend logic: `lib/`

Pure functions. They take inputs and return outputs, with no React and no network. Each file has a matching `*.test.ts` (44 tests in total, run with `npm test`).

### 6.1 [validation.ts](../frontend/src/lib/validation.ts)

**`Result<T>`** is either `{ ok: true, value }` or `{ ok: false, error }`. Functions return this instead of throwing, which makes the success and error cases explicit.

**`parseEthAmount(input, { allowZero })`** turns user text into wei:
1. Trims spaces. Empty → "Enter an amount".
2. Starts with `-` → "Amount cannot be negative".
3. Contains `e` → rejected, so `1e-3` is not accepted.
4. Must look like a number: `12`, `0.5`, `.5` and `1.` are accepted.
5. More than 18 digits after the dot → rejected (wei is the smallest unit).
6. Converts with `parseEther`, which is exact. JavaScript decimals are not (`0.1 + 0.2 = 0.30000000000000004`).
7. A result of 0 is rejected unless `allowZero` is set.

**`validateAddress(input, { contractAddress, senderAddress })`** checks one recipient:
1. Empty → error.
2. Must be `0x` followed by 40 hexadecimal characters.
3. `getAddress(text)` converts it to the **checksummed** form (the mixed-case version). If the user typed a mixed-case address whose capitals don't match the checksum, it throws, which usually means a typo. We report "Checksum mismatch".
4. Rejects the zero address, the contract's address and the user's own address.
5. Returns the checksummed address.

`sameAddress(a, b)` compares two addresses ignoring capital letters.

**`validateForm(form, ctx)`** checks the whole form and returns per-row errors plus the final arrays:
1. Form-level errors: no rows, or more than 20.
2. Runs `validateAddress` on every row.
3. **Duplicates:** a `Map` remembers the first row of each lowercase address. Later copies get "Duplicate of recipient #N".
4. **Amounts:**
   - **Custom mode:** `parseEthAmount` on each row.
   - **Equal mode:** parse the total, require at least 1 wei per person, then `equalSplit(total, n)` fills each row's amount.
5. `isValid` is true only if there are no errors anywhere.
6. Returns `recipients`, `amounts` and `total`, which are the exact values sent to the contract.

### 6.2 [split.ts](../frontend/src/lib/split.ts)

**`equalSplit(total, n)`**:

```ts
share = total / n          // bigint division rounds down
remainder = total % n      // leftover wei, between 0 and n-1
// the first `remainder` people get share + 1, the rest get share
```

For example, 10 wei / 3 → `[4, 3, 3]`, which sums to exactly 10. It throws a `RangeError` for invalid `n` or a negative total.

**`sumWei(values)`** adds up bigints.

**`estimateGasUpperBound(n, chainId)`** gives a deliberately generous gas guess, used only for the "you may not have enough ETH" warning. It is `50,000 + 40,000 × n` on the local chain and `300,000 + 230,000 × n` on Sepolia, where gas is more expensive (see TEST_RESULTS.md §7). MetaMask shows the real fee.

### 6.3 [format.ts](../frontend/src/lib/format.ts)

| Function | Example |
|---|---|
| `shortenAddress(addr)` | `0x3Ff9C1…45fC` → `0x3Ff9…45fC` |
| `formatEth(wei, maxDecimals)` | Rounds **down** for display: `0.0123456789` → `0.012345`. Tiny non-zero values show as `<0.000001` |
| `formatEthExact(wei)` | Full precision, used where exactness matters (review modal, history) |
| `chainName(id)` | `11155111` → `Sepolia`, `31337` → `Hardhat Local` |
| `txUrl(chainId, hash)` / `addressUrl(chainId, address)` | Etherscan link on Sepolia, `null` elsewhere (no explorer for the local chain) |
| `formatTimestamp(seconds)` | Block time → local date and time |

### 6.4 [chunks.ts](../frontend/src/lib/chunks.ts)

RPC providers refuse to search logs over huge block ranges. This file handles that.

- **`fetchInChunks(from, to, fetchRange, { chunkSize, onProgress })`** splits `[from, to]` into pieces of `chunkSize` blocks and calls `fetchRange` on each piece in order. If a piece fails with a "range too large" error, it halves `chunkSize` and retries that piece, down to 1 block. Any other error is thrown. `onProgress` reports a fraction from 0 to 1.
- **`isRangeTooLargeError(error)`** collects the error's text (via `collectErrorText`, which also looks inside nested `error` / `info` objects) and matches typical provider messages such as "block range too large", "query returned more than 10000 results" or code `-32005`.

### 6.5 [errors.ts](../frontend/src/lib/errors.ts)

Errors from ethers and MetaMask are deeply nested objects. This file turns them into one readable message.

| Function | What it does |
|---|---|
| `REJECTED_MESSAGE` | "You rejected the transaction in MetaMask. No ETH was sent." |
| `describeContractError(name, args)` | A `switch` over the 12 custom errors returning English. Indexes are shown 1-based, so contract index 2 becomes "Recipient #3" |
| `walk(error)` | A generator that visits the error and its nested `error`, `info`, `data`, `cause` and `originalError` objects |
| `findRevertData(error)` | Finds the raw revert data (`0x` + 4-byte error selector + arguments) anywhere inside the error |
| `isUserRejection(error)` | `true` if any level has code `ACTION_REJECTED` (ethers) or `4001` (MetaMask) |
| `isInsufficientFunds(error)` | `true` for code `INSUFFICIENT_FUNDS` or the text "insufficient funds" |
| `toFriendlyError(error)` | Tries, in order: rejection → ethers' already-decoded `revert` field → decoding the raw revert data with the ABI (`iface.parseError`) → insufficient funds → the error's short message. Returns `{ kind, message, errorName? }` |

---

## 7. Frontend state: `hooks/`

A **hook** is a React function (named `useSomething`) that holds data that changes over time and re-renders the page when it does. Two built-in hooks appear everywhere:

- **`useState`** stores a value; calling its setter re-renders the page.
- **`useEffect`** runs code after rendering, such as subscribing to MetaMask events or fetching data. It can return a cleanup function.
- **`useCallback`** / **`useMemo`** remember a function or computed value between renders, until their inputs change.

### 7.1 [useAsyncData.ts](../frontend/src/hooks/useAsyncData.ts)

A small helper the other hooks use to load data such as balances, `paymentCount` and history.

```ts
const { value, error, loading, reload } = useAsyncData(key, load)
```

- `key` describes *what* is being loaded, for example `"11155111:0xYourAddress"`. If `key` is `null`, nothing is loaded.
- `load` is the async function that fetches it.
- Each result is stored **together with the key it was loaded for**. When you switch account or network the key changes, so the old value is not shown as if it belonged to the new one.
- `reload()` bumps an internal version number to fetch again. During a reload of the *same* key, the previous value stays on screen so nothing flickers.
- The `cancelled` flag in the cleanup ignores slow answers that arrive after the key has already changed.

### 7.2 [useWallet.ts](../frontend/src/hooks/useWallet.ts)

Everything about MetaMask. Returns `{ hasWallet, account, chainId, balance, connecting, error, provider, connect, switchChain, refreshBalance }`.

| Part | What it does |
|---|---|
| `toChainId(hex)` | MetaMask reports chain IDs as hex strings (`"0xaa36a7"`); converts to a number (`11155111`) |
| `provider` (`useMemo`) | `new BrowserProvider(window.ethereum)`, recreated whenever the chain changes, because an ethers provider is tied to one network |
| First `useEffect` | On page load, asks `eth_accounts` (returns your address only if you connected before, never shows a popup) and `eth_chainId` |
| Second `useEffect` | Subscribes to `accountsChanged` and `chainChanged`, so switching in MetaMask updates the app live. The cleanup unsubscribes |
| `loadBalance` + `useAsyncData` | Reads `provider.getBalance(account)`, keyed by chain and account. `refreshBalance` re-reads it |
| `connect()` | Only called by the Connect button. `eth_requestAccounts` opens the MetaMask popup. Code `4001` means the user rejected it |
| `switchChain(id)` | `wallet_switchEthereumChain`. Error `4902` means MetaMask doesn't know the network, so it then calls `wallet_addEthereumChain` with `ADD_CHAIN_PARAMS` |

### 7.3 [useSmartSplit.ts](../frontend/src/hooks/useSmartSplit.ts)

Everything about talking to the contract. Returns `{ contract, tx, resetTx, sendPayment, paymentCount, refreshPaymentCount, gasPrice, sessionTxs }`.

**Types:**
- **`TxState`** is the payment status: `idle`, `checking`, `awaiting-signature`, `pending` (with hash), `confirmed` (with block, gas, payment ID), `failed` (with message) or `rejected`. Each status carries only the data that makes sense for it.
- **`SessionTx`** is one transaction sent from this browser tab, used for the "This session" list.

**Pieces, in order:**

| Part | What it does |
|---|---|
| `loadSession()` | Reads the "This session" list from `sessionStorage`, which survives a page refresh but not closing the tab |
| `txEntry` / `tx` / `setTx` | The current `TxState`, remembered together with the chain it belongs to. Switching network shows `idle` again |
| `contract` (`useMemo`) | `new Contract(address, ABI, provider)`, the JavaScript object whose methods are the contract's functions |
| `upsertSessionTx(entry)` | Adds or updates one entry in the session list (newest first, at most 20) and saves it to `sessionStorage` |
| `loadPaymentCount` | `contract.paymentCount()`, a **read** call. Loaded with `useAsyncData`; `refreshPaymentCount` re-reads it |
| `loadGasPrice` | `provider.getFeeData()` → the current max fee per gas, for the balance warning |
| `resetTx()` | Back to `idle` (the Clear button) |
| `sendPayment(recipients, amounts)` | The payment itself. See below |

**`sendPayment`, step by step:**

```ts
const value = sumWei(amounts)                         // ETH to attach, in wei
const signer = await provider.getSigner()             // your MetaMask account
const writable = contract.connect(signer)             // same contract, now able to send transactions

setTx({ status: 'checking' })
await writable.splitPayment.staticCall(recipients, amounts, { value })   // simulate: would it succeed?
await writable.splitPayment.estimateGas(recipients, amounts, { value })  // simulate: how much gas?
//   ↳ if either throws: status 'failed' with beforeSending = true, MetaMask never opened

setTx({ status: 'awaiting-signature' })
const response = await writable.splitPayment(recipients, amounts, { value })  // MetaMask popup
//   ↳ resolves once you click Confirm; response.hash is the transaction ID

setTx({ status: 'pending', hash })
const receipt = await response.wait(1)                // wait until it is in a block
//   ↳ receipt.status === 1 means success, 0 means it reverted

// read our PaymentSplit event out of the receipt to get the payment ID
for (const log of receipt.logs) contract.interface.parseLog(log)

setTx({ status: 'confirmed', hash, blockNumber, gasUsed, paymentId })
refreshPaymentCount()
return true
```

Any error lands in the `catch` block. `toFriendlyError(e)` decides between `rejected` (you clicked Reject) and `failed`.

**Why simulate first?** `staticCall` runs the function on a node without creating a transaction. If the contract would revert, we learn the exact custom error for free, instead of the user paying gas for a transaction that is bound to fail.

**Why does `{ value }` go last?** In ethers, an extra object after the function arguments holds transaction options. `value` is the ETH to attach, which becomes `msg.value` inside the contract.

### 7.4 [usePaymentHistory.ts](../frontend/src/hooks/usePaymentHistory.ts)

Builds the history list from events. Returns `{ records, loading, progress, error, refresh }`.

**`PaymentRecord`** is one row: `paymentId`, `sender`, `recipients`, `amounts`, `total`, `timestamp`, `txHash`, `blockNumber`.

**`load()`:**
1. `provider.send('eth_blockNumber', [])` gets the newest block. This asks the node directly, because ethers briefly caches `getBlockNumber()` and that cache could miss a payment that was confirmed a second ago.
2. Builds the filter:
   - **All payments:** `contract.filters.PaymentSplit()`
   - **My payments:** `contract.filters.PaymentSplit(null, account)`. The first argument (`paymentId`) is `null`, meaning any value; the second matches the indexed `sender`.
3. `fetchInChunks(deployBlock, latest, (from, to) => contract.queryFilter(filter, from, to), …)` searches in pieces and reports progress.
4. Keeps the decoded events (`EventLog`) and maps each one's `log.args` to a `PaymentRecord`.
5. `.reverse()` puts the newest first.

The load is keyed by contract address + filter + account, so switching between "My" and "All" or changing account loads the right list. `refresh` reloads it after a payment.

---

## 8. Frontend UI: components and App.tsx

Components receive data through **props** (function arguments) and report user actions through callback props such as `onConfirm`. They don't talk to the blockchain themselves.

### 8.1 [ui.tsx](../frontend/src/components/ui.tsx): shared building blocks

| Export | What it renders |
|---|---|
| `Panel` | A floating white card with an optional step number, title, subtitle and action buttons |
| `Chip` | A small rounded label with a coloured dot (for example "Confirmed") |
| `ExternalLink` | A link that opens in a new tab, with an arrow icon |
| `Segmented` | A two-option toggle ("Custom amounts / Equal split", "My payments / All payments"), built as accessible radio buttons |
| `buttonPrimary`, `buttonSoft`, `iconButton`, `inputBase`, `eyebrow` | Reusable Tailwind class strings, so every button and input looks the same |

### 8.2 Small components

| Component | What it does |
|---|---|
| [Logo](../frontend/src/components/Logo.tsx) | The SVG logo: one dot splitting into three |
| [CopyButton](../frontend/src/components/CopyButton.tsx) | Copies text with `navigator.clipboard.writeText` and shows a tick for 1.5 seconds |
| [Header](../frontend/src/components/Header.tsx) | Logo, "Testnet only" notice, network chip (green if supported, red if not), and either the Connect button or your short address |
| [Notices](../frontend/src/components/Notices.tsx) | `InstallMetaMask` (no wallet), `NetworkBanner` (wrong network, with "Switch to Sepolia"), `NoContractNotice` (no address configured for this chain). `Notice` is their shared layout |
| [DashboardCards](../frontend/src/components/DashboardCards.tsx) | The four readings: balance, network, contract (with Etherscan link) and on-chain payment count. `Stat` is one cell |

### 8.3 [PaymentForm.tsx](../frontend/src/components/PaymentForm.tsx): step 1

- Shows the mode toggle, the "Total to split" field in equal mode, and one row per recipient (address, optional label, amount or computed share, remove button).
- **`visible(value, error)`** decides when to show an error: only once the user has typed in that field, or after they pressed Review (`showAllErrors`). This avoids shouting at an empty form.
- **`FieldError`** shows one error message and is linked to its input with `aria-describedby`, so screen readers read it too.
- Every edit calls `onChange` with a new form object; the form state itself lives in `App.tsx`.
- "Add recipient" is disabled at 20. "Review payment" submits the form, which calls `onReview`.

### 8.4 [PaymentSummary.tsx](../frontend/src/components/PaymentSummary.tsx)

Shows the total being sent, the number of recipients, the estimated maximum gas fee and your balance. If `total + estimated gas > balance`, it shows a warning. `Line` is one label/value row.

### 8.5 [ReviewModal.tsx](../frontend/src/components/ReviewModal.tsx): step 2

- `ReviewModal` renders nothing when closed, and `ReviewDialog` when open. Mounting a fresh dialog each time means the checkbox always starts unticked.
- It shows the network, the contract address, every **full** checksummed recipient address with its amount, and the total.
- "Confirm in MetaMask" stays disabled until "I have checked the recipient addresses" is ticked.
- **Keyboard support** (`useEffect`): Escape closes the dialog; Tab cycles only through the dialog's controls (a focus trap); focus returns to where it was when the dialog closes. Clicking the dimmed background also closes it.

### 8.6 [TxStatusPanel.tsx](../frontend/src/components/TxStatusPanel.tsx): step 3

- **`stepStates(tx)`** converts the current `TxState` into the state of each of the four steps (Check, Sign, Pending, Confirmed): `upcoming`, `current`, `done` or `failed`. For example, `pending` gives done, done, current, upcoming; `rejected` gives done, failed, upcoming, upcoming.
- **`Stepper`** draws the four circles and connecting lines.
- **`Message`** shows the title and text for the current state ("Pending — waiting for a block", "Confirmed", "Blocked before sending", …).
- **`TxHash`** shows the transaction hash with "View on Etherscan", or "Local network — no explorer".
- The `aria-live="polite"` area makes screen readers announce status changes.

### 8.7 [HistoryPanel.tsx](../frontend/src/components/HistoryPanel.tsx)

- The header has the My/All toggle and a refresh button.
- It shows loading progress, errors, or "No payments yet."
- **`PaymentItem`** is one collapsible payment (`<details>`): ID, Confirmed chip, "you" if you sent it, total, and when expanded the sender, time, transaction link and the recipients table.
- **`HashLink`** is a shortened hash that links to Etherscan on Sepolia.
- **"This session"** lists the `sessionTxs` for the current chain (pending, confirmed or failed), kept separate from the on-chain list on purpose.

### 8.8 [App.tsx](../frontend/src/App.tsx): wiring everything together

**Helpers outside the component:**
- `emptyRow()` creates a blank recipient row with a unique `id`, which React uses as the list key.
- `emptyForm()` creates custom mode with one blank row.

**Inside `App()`, top to bottom:**

```ts
const wallet = useWallet()                                   // MetaMask state
const deployment = getDeployment(wallet.chainId)             // contract address for this chain (or null)
const smartSplit = useSmartSplit(wallet.provider, wallet.chainId, deployment)
const history = usePaymentHistory(wallet.provider, smartSplit.contract,
                                  deployment?.deployBlock ?? null, wallet.account, historyFilter)
```

| Piece | Purpose |
|---|---|
| `form`, `setForm` | The whole form (mode, rows, equal total) |
| `showAllErrors` | Becomes true after the first Review click |
| `reviewOpen` | Whether the review modal is visible |
| `validation` (`useMemo`) | `validateForm(form, { contractAddress, senderAddress })`, recalculated whenever the form, contract or account changes |
| `draftTotal` | Sum of the amounts that are valid so far (for the summary while typing) |
| `estimatedGasCost` | `estimateGasUpperBound(rows, chainId) × gasPrice` |
| `busy` | `true` while checking, awaiting a signature or pending; the form is disabled then |
| `onReview()` | Turns on `showAllErrors`, and opens the modal only if the form is valid and the wallet is connected |
| `onConfirm()` | Closes the modal and calls `sendPayment`. If it returns `true`: reset the form, refresh the balance and reload the history |

**What gets rendered depends on the situation:**

| Situation | Shown |
|---|---|
| No MetaMask | `InstallMetaMask` |
| Unsupported chain | `NetworkBanner` |
| Supported chain but no address configured | `NoContractNotice` |
| MetaMask installed | `DashboardCards` |
| Supported chain with a contract | Form, Summary, Status, History and the Review modal |

---

## 9. End-to-end flows

### 9.1 Opening the page

1. `main.tsx` renders `App`.
2. `useWallet` checks for `window.ethereum`, then silently asks for `eth_accounts` and `eth_chainId`.
3. `getDeployment(chainId)` finds the Sepolia address in `contracts.ts`.
4. `useSmartSplit` creates the `Contract` object and reads `paymentCount()` and the fee data.
5. `usePaymentHistory` loads the `PaymentSplit` events from block 11904281 to now.

All of these are reads, so no popup appears and no gas is spent. That is why history shows even before you click Connect.

### 9.2 Connecting

1. Click **Connect MetaMask** → `wallet.connect()` → `eth_requestAccounts` → the MetaMask popup.
2. Approve → `account` is set → the balance loads, the header shows your address, and the form becomes active.

### 9.3 Typing a payment

Every keystroke: `PaymentForm` → `onChange` → `setForm` → `validateForm` runs again → errors and totals update instantly. Nothing is sent anywhere while you type.

### 9.4 Sending a payment

```
Review payment ─▶ validation ok? ─▶ ReviewModal ─▶ tick box ─▶ Confirm in MetaMask
   ─▶ sendPayment
        checking ─────────▶ staticCall + estimateGas      (fails → "Blocked before sending")
        awaiting-signature ▶ splitPayment(...) → popup    (Reject → "rejected")
        pending ──────────▶ we have the hash; Etherscan link shown
        confirmed ────────▶ receipt.status === 1, payment ID from the event
   ─▶ App: reset form, refreshBalance(), history.refresh()
```

Meanwhile, on the blockchain, `splitPayment` runs its checks, increments `paymentCount`, sends each amount and emits `PaymentSplit`.

### 9.5 How history appears

Your payment's `PaymentSplit` event is now stored in its block → `history.refresh()` → `queryFilter` finds it → `PaymentItem` shows it at the top, marked Confirmed, with an Etherscan link.

### 9.6 When something goes wrong

| What happened | Where it is caught | What you see |
|---|---|---|
| Duplicate address typed | `validateForm` | Red message under the row; Review won't open |
| A recipient contract refuses ETH | `staticCall` in `sendPayment` → `toFriendlyError` decodes `TransferFailed` | "Blocked before sending …"; MetaMask never opens |
| You click Reject in MetaMask | `catch` in `sendPayment`, code 4001 | "You rejected the transaction in MetaMask. No ETH was sent." |
| Not enough ETH | Summary warning; `INSUFFICIENT_FUNDS` if sent anyway | Warning, or a "not enough ETH" message |
| Wrong network in MetaMask | `chainChanged` → `isSupportedChain` is false | "Wrong network" banner with a switch button |

---

## 10. Contract ↔ frontend cheat sheet

| In the contract | In the frontend | File |
|---|---|---|
| `splitPayment(recipients, amounts)` + `msg.value` | `writable.splitPayment(recipients, amounts, { value })` | `hooks/useSmartSplit.ts` |
| Simulation of `splitPayment` | `splitPayment.staticCall(...)`, `splitPayment.estimateGas(...)` | `hooks/useSmartSplit.ts` |
| `paymentCount` (public variable) | `contract.paymentCount()` | `hooks/useSmartSplit.ts` |
| `MAX_RECIPIENTS = 20` | `MAX_RECIPIENTS = 20` (mirrored for the UI) | `lib/validation.ts` |
| `event PaymentSplit` | `contract.filters.PaymentSplit(...)` + `queryFilter` | `hooks/usePaymentHistory.ts` |
| `indexed sender` | `filters.PaymentSplit(null, account)` ("My payments") | `hooks/usePaymentHistory.ts` |
| Event in the receipt | `contract.interface.parseLog(log)` → payment ID | `hooks/useSmartSplit.ts` |
| Custom errors | `iface.parseError(data)` → `describeContractError` | `lib/errors.ts` |
| `ZeroAddress` / `SenderAsRecipient` / `ContractAsRecipient` / `DuplicateRecipient` / `ZeroAmount` | Same rules checked earlier, in `validateAddress` / `validateForm` | `lib/validation.ts` |
| `IncorrectValue` (exact value) | `value = sumWei(amounts)`, always exact | `hooks/useSmartSplit.ts` |
| Contract address | `CONTRACTS[chainId].address` | `config/contracts.ts` |
| Function/event/error definitions | `abi/SmartSplit.json` → `new Contract(address, ABI, provider)` | `lib/contract.ts` |

**Why are the rules checked twice (frontend and contract)?** The frontend checks give instant, friendly feedback. The contract checks are the real protection: anyone can call the contract directly (from Remix, for example), skipping the website entirely.

---

## 11. Check your understanding

Try answering these. Each one has its answer somewhere above.

1. Where does the website get the contract address, and what writes that file?
2. Why does reading `paymentCount` never open MetaMask, while `splitPayment` always does?
3. What exactly does `{ value }` in `splitPayment(recipients, amounts, { value })` become inside the contract?
4. What happens on-chain if the third of five recipients refuses the ETH?
5. How does "My payments" avoid downloading everybody's payments?
6. Why does the app call `staticCall` before the real transaction?
7. 0.1 ETH split equally among 7 people: why doesn't anyone lose a wei?
8. Why is "Confirmed" only shown after `response.wait(1)`, and not as soon as there is a hash?
9. If you switch MetaMask from Sepolia to another network, which function notices, and what does the page show?
10. Why can't ETH ever get stuck inside the contract? (There are two separate reasons.)

**Small experiments** (on the local chain, then undo them):
- In `validation.ts`, temporarily remove the duplicate check, then try to pay the same address twice. The contract's `DuplicateRecipient` now catches it, and you will see "Blocked before sending". This shows why the contract checks again.
- Run `npm run demo:local` and compare its printed numbers with the test expectations in `SmartSplit.test.ts`.
- In Remix, call `splitPayment` with a VALUE 1 wei too low and read the decoded `IncorrectValue` error in the console.
