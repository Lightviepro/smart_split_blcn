# Smart Split — Architecture

Smart Split has **three parts and no server**:

1. **`SmartSplit.sol`**, a smart contract on Ethereum (Sepolia testnet, or a local Hardhat chain in development). It is the whole "backend": it checks the payment, forwards the ETH and records an event.
2. **A React web app** that builds the payment, checks it, and shows status and history.
3. **MetaMask**, the user's wallet. It holds the private key and signs transactions. The web app never sees the key.

Rendered images of the diagrams below (SVG for screens, PNG for the printed report) are in [`docs/images/`](images/): `architecture-components`, `architecture-sequence`, `architecture-tx-states` and `architecture-dev-flow` (`.svg` / `.png`).

## 1. Components

```mermaid
flowchart LR
    subgraph Browser["User's browser"]
        UI["React + Vite frontend<br/>(form · review · status · history)"]
        MM["MetaMask<br/>(holds the private key,<br/>signs transactions)"]
    end

    subgraph Chain["Ethereum: Sepolia (11155111) or Hardhat Local (31337)"]
        SC["SmartSplit.sol<br/>splitPayment()"]
        EV[("Event log<br/>PaymentSplit events")]
        R1["Recipient 1"]
        R2["Recipient 2"]
        RN["Recipient N (≤ 20)"]
    end

    ES["sepolia.etherscan.io<br/>(public block explorer)"]

    UI -- "ethers.js v6<br/>BrowserProvider(window.ethereum)" --> MM
    MM -- "JSON-RPC: signed tx,<br/>eth_call, eth_getLogs" --> SC
    SC -- "ETH via call{value}" --> R1
    SC -- "ETH via call{value}" --> R2
    SC -- "ETH via call{value}" --> RN
    SC -- "emit PaymentSplit" --> EV
    EV -- "queryFilter (history)" --> UI
    UI -. "links to /tx/&lt;hash&gt;" .-> ES
```

| Part | Technology | Responsibility |
|---|---|---|
| Smart contract | Solidity 0.8.28 | Validate inputs, forward exact amounts, all-or-nothing, emit `PaymentSplit` |
| Frontend | React 19, Vite 8, TypeScript, Tailwind 4, ethers v6 | Form, validation, review, status, history |
| Wallet | MetaMask | Accounts, network selection, signing, broadcasting |
| Dev tooling | Hardhat 3 (tests, coverage, gas, deploy scripts), Remix IDE (visual demo, Sepolia deployment) | Build, test, deploy |
| History storage | Ethereum event logs | Permanent, public, needs no database |

### Why there is no backend server or database
- The contract **is** the backend logic. Its rules run on every Ethereum node, so nobody (including us) can change them for one user.
- **Events are the database.** Every successful payment emits `PaymentSplit(paymentId, sender, recipients, amounts, total, timestamp)`. The frontend rebuilds the history by querying these logs from the block the contract was deployed in (`deployBlock`).
- Fewer parts to secure and host: there is no server, no API key in the frontend, and no stored user data.

## 2. One payment, step by step

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant UI as Frontend (React)
    participant MM as MetaMask
    participant SC as SmartSplit contract
    participant R as Recipients (1..20)

    U->>UI: Enter recipients + amounts (or total for an equal split)
    UI->>UI: Validate (addresses, checksum, duplicates, amounts as bigint wei)
    U->>UI: Review payment → tick "I have checked the recipient addresses"
    UI->>SC: staticCall + estimateGas (simulation, nothing is sent)
    alt simulation reverts
        SC-->>UI: custom error (e.g. TransferFailed)
        UI-->>U: "Blocked before sending" + plain-English reason (MetaMask not opened)
    else simulation OK
        UI->>MM: splitPayment(recipients, amounts, {value: total})
        MM->>U: Confirmation popup (amount + gas fee)
        alt user rejects
            MM-->>UI: error 4001 / ACTION_REJECTED
            UI-->>U: "You rejected the transaction in MetaMask. No ETH was sent."
        else user confirms
            MM->>SC: signed transaction (broadcast)
            UI-->>U: Pending (tx hash, Etherscan link)
            Note over SC: 1. lock (nonReentrant)<br/>2. checks (all rules, exact msg.value)<br/>3. effects (paymentCount++)<br/>4. interactions (send ETH)
            loop for each recipient
                SC->>R: call{value: amounts[i]}("")
                R-->>SC: ok (or revert → whole tx reverts)
            end
            SC->>SC: emit PaymentSplit(...)
            SC-->>UI: receipt (status 1) after tx.wait(1)
            UI-->>U: Confirmed (block, gas used)
            UI->>SC: queryFilter(PaymentSplit) → refresh history, balance, paymentCount
        end
    end
```

## 3. Contract design in one paragraph

`splitPayment(address[] recipients, uint256[] amounts)` is `payable`. It first takes a simple reentrancy lock. Next it validates **everything**: 1–20 recipients, equal-length arrays, no zero address, not the contract, not the sender, no zero amount, no duplicates, and `msg.value == sum(amounts)` exactly. Then it increments `paymentCount` (effects). Only then does it send each amount with a low-level `call` (interactions). If any send fails, the whole transaction reverts, so either everyone is paid or no one is. Finally it emits `PaymentSplit`. Because `msg.value` must match exactly and everything is forwarded in the same transaction, the contract's balance is always 0. Plain ETH transfers to the contract are rejected (`receive`/`fallback` revert).

## 4. Frontend modules

```
frontend/src/
├── config/contracts.ts      chainId → { address, deployBlock }  (written by deploy/export-abi scripts)
├── config/chains.ts         supported chains, wallet_addEthereumChain params, log chunk size
├── abi/SmartSplit.json      ABI exported from Hardhat
├── lib/                     pure logic, unit-tested with Vitest
│   ├── validation.ts        parseEthAmount, validateAddress, validateForm
│   ├── split.ts             equalSplit (bigint wei, remainder to first recipients), gas upper bound
│   ├── format.ts            ETH/address/time formatting, Etherscan links
│   ├── errors.ts            custom error → plain English; rejection detection
│   ├── chunks.ts            fetchInChunks: getLogs in block ranges, halving on "range too large"
│   └── contract.ts          ABI + ethers Interface
├── hooks/
│   ├── useWallet.ts         connect, silent restore, accountsChanged/chainChanged, switch network, balance
│   ├── useSmartSplit.ts     contract instance, paymentCount, sendPayment state machine, session list
│   ├── usePaymentHistory.ts PaymentSplit events (My / All), chunked
│   └── useAsyncData.ts      async loading keyed by (chain, account, …) so stale data never shows
└── components/              Header, Notices, DashboardCards, PaymentForm, PaymentSummary,
                             ReviewModal, TxStatusPanel, HistoryPanel, CopyButton, ui
```

**Transaction status machine** (`useSmartSplit.sendPayment`):

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> checking: Confirm in modal
    checking --> failed: simulation reverts (MetaMask not opened)
    checking --> awaiting_signature: simulation OK
    awaiting_signature --> rejected: user rejects (4001)
    awaiting_signature --> pending: tx broadcast (hash known)
    pending --> confirmed: receipt.status == 1
    pending --> failed: reverted / dropped
    confirmed --> idle: Clear / new payment
    failed --> idle
    rejected --> idle
```

"Confirmed" appears **only** after `tx.wait(1)` returns a receipt with `status === 1`.

## 5. Money handling

- Every amount is a `bigint` in **wei** (1 ETH = 10¹⁸ wei). User input is converted only with `ethers.parseEther`. JavaScript floating-point numbers are never used for money (`0.1 + 0.2 !== 0.3` in JS).
- **Equal split:** `share = total / n`, `remainder = total % n`, and the first `remainder` recipients get one extra wei, so the parts add up to exactly `total`. Example: 0.1 ETH / 7 gives five recipients 0.014285714285714286 ETH and two recipients 0.014285714285714285 ETH.

## 6. Development and deployment flow

```mermaid
flowchart LR
    SOL["contracts/SmartSplit.sol"] --> HH["Hardhat 3<br/>compile · test · coverage · gas"]
    SOL --> RX["Remix IDE<br/>(same file, 0.8.28, optimizer 200)"]
    HH -- "npm run deploy:local / deploy:sepolia" --> DEP["deployments/&lt;network&gt;.json"]
    RX -- "Injected Provider – MetaMask" --> SEP["Sepolia contract"]
    SEP -- "npm run export-abi -- --address --block --chain" --> CFG
    HH -- "deploy script" --> CFG["frontend/src/config/contracts.ts<br/>frontend/src/abi/SmartSplit.json"]
    CFG --> FE["Frontend build"]
```
