# Smart Split — Build Specification for Claude Code

> **How to use this file:** Put it in an empty project folder, open Claude Code there, and say:
> *"Read SMART_SPLIT_SPEC.md and build the project phase by phase. Stop only at the checkpoints marked 🛑."*

This spec is the **approved design**. Do not re-open the design discussion. Build it, verify each phase with real commands, and stop only at the 🛑 checkpoints. If something in this spec turns out to be technically wrong (for example, a tool version behaves differently), choose the simplest correct fix, note it in `docs/DECISIONS.md`, and continue.

---

## 0. Context

- **What:** Smart Split, a dApp that splits one ETH payment among several recipients in a single transaction via a Solidity smart contract.
- **Who:** A college student's Blockchain Lab project. It will be demonstrated live and explained in a viva. **Simplicity and explainability beat features.**
- **Network:** Ethereum **Sepolia** testnet (chainId `11155111`) for the live demo; **Hardhat local network** (chainId `31337`) for development.
- **Wallet:** MetaMask. The student has ~0.4 Sepolia ETH. Demo payments should use tiny amounts (e.g. 0.001–0.01 ETH).
- **Tools required:** Solidity, Hardhat (primary dev + tests), **Remix IDE (must be used — see §6)**, React + Vite + TypeScript + Tailwind, ethers.js v6.
- **No backend server, no database.** The smart contract *is* the backend; contract events are the source of truth for history.

### Hard rules (never break)
1. Never ask for, request, print, or store a seed phrase or private key. Never commit secrets. `.env` is git-ignored; ship `.env.example` only.
2. Never touch mainnet. Hardhat config contains only `hardhat`, `localhost`, and `sepolia` networks.
3. Never claim tests passed, a build succeeded, or a deployment happened unless you ran the command and saw it succeed. Paste real output summaries.
4. Never fabricate transaction history, hashes, addresses, or "results" in docs. Use clearly marked placeholders (`<<FILL AFTER DEPLOY>>`) until real values exist.
5. Never deploy to Sepolia without the student's explicit go-ahead (🛑 checkpoint).
6. Out of scope: tokens, NFTs, DeFi, auth/login systems, databases, AI features, upgradeable proxies, ownership/admin roles, fees.

---

## 1. Architecture

```
 ┌──────────────────────┐   ethers.js v6    ┌──────────────┐   JSON-RPC    ┌────────────────────┐
 │ React + Vite frontend│ ───────────────▶  │   MetaMask   │ ───────────▶  │ Sepolia / Hardhat  │
 │ (form, review, status│ ◀───────────────  │ (signs tx,   │ ◀───────────  │  node              │
 │  history)            │   events, receipts│  holds keys) │               │  └ SmartSplit.sol  │
 └──────────────────────┘                   └──────────────┘               └────────────────────┘
          │                                                                         │
          └──────────────── links to sepolia.etherscan.io/tx/<hash> ◀───────────────┘
```

- The frontend reads and writes **only through MetaMask** (`ethers.BrowserProvider(window.ethereum)`). No RPC API key is needed in the frontend.
- Flow: user fills form → frontend validates → review modal → `contract.splitPayment(recipients, amounts, { value: total })` → MetaMask confirm → "pending" with hash → `await tx.wait(1)` → "confirmed" (only now) → history refreshes from `PaymentSplit` events.
- The contract never holds ETH between transactions. It receives `msg.value` and forwards all of it in the same transaction, or the whole transaction reverts.

---

## 2. Repository layout

Use a simple two-folder monorepo (no workspace tooling needed):

```
smart-split/
├── README.md
├── .gitignore                 # node_modules, .env, artifacts, cache, dist, coverage, typechain output
├── contracts-hardhat/         # Hardhat project
│   ├── contracts/
│   │   ├── SmartSplit.sol     # THE contract — self-contained, no imports (Remix-friendly)
│   │   └── test-helpers/
│   │       ├── RejectingReceiver.sol   # reverts on receive (tests failed transfer)
│   │       └── ReentrantReceiver.sol   # tries to re-enter splitPayment (tests guard)
│   ├── test/SmartSplit.test.(ts|js)
│   ├── scripts/
│   │   ├── deploy.(ts|js)              # deploys + writes deployment info + exports ABI to frontend
│   │   ├── export-abi.(ts|js)          # copies ABI + address into frontend (also usable after a Remix deploy)
│   │   └── demo-local.(ts|js)          # scripted end-to-end split on local node, prints balances before/after
│   ├── deployments/                    # {network}.json: address, deployer, txHash, blockNumber, chainId
│   ├── hardhat.config.(ts|js)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── config/contracts.ts         # per-chain { address, deployBlock } — generated/updated by scripts
│   │   ├── abi/SmartSplit.json         # generated
│   │   ├── lib/                        # pure, unit-tested logic: validation.ts, split.ts, format.ts, errors.ts
│   │   ├── hooks/                      # useWallet.ts, useSmartSplit.ts, usePaymentHistory.ts
│   │   ├── components/
│   │   └── App.tsx
│   └── (vite/tailwind/ts config, vitest config)
├── remix/
│   └── REMIX_GUIDE.md                  # step-by-step Remix workflow (see §6)
└── docs/
    ├── DECISIONS.md          # any deviations from this spec and why
    ├── ARCHITECTURE.md       # diagram (Mermaid) + explanation; also export diagram as PNG/SVG if feasible
    ├── REPORT.md             # college project report
    ├── VIVA.md               # ≥ 25 Q&A
    ├── DEMO_SCRIPT.md        # live demo walkthrough
    └── TEST_RESULTS.md       # real output of test runs, gas report, local demo, Sepolia tests
```

---

## 3. Smart contract specification — `SmartSplit.sol`

### 3.1 Settings
- `// SPDX-License-Identifier: MIT`
- `pragma solidity 0.8.28;` (exact pin). Use **the same compiler version in Hardhat and Remix**. Optimizer on, 200 runs, in both.
- **No imports.** The file must compile in Remix by pasting it alone.
- Heavy NatSpec comments: the student will read this file aloud in a viva. Comment *why*, not just *what*.

### 3.2 Design (atomic push-payment, all-or-nothing)
Chosen pattern: **push payments with exact-value check, checks-effects-interactions, a simple reentrancy lock, and all-or-nothing revert.** If any single transfer fails, the entire transaction reverts and the sender keeps their ETH (minus gas). This is the easiest correct design to explain. (The pull/withdraw pattern is the documented alternative — mention it in VIVA.md and REPORT limitations, do not implement it.)

### 3.3 Interface

```solidity
uint256 public constant MAX_RECIPIENTS = 20;
uint256 public paymentCount;            // increments per successful split; used as paymentId

event PaymentSplit(
    uint256 indexed paymentId,
    address indexed sender,
    address[] recipients,
    uint256[] amounts,
    uint256 total,
    uint256 timestamp
);

function splitPayment(address[] calldata recipients, uint256[] calldata amounts)
    external payable;

receive() external payable  { revert DirectPaymentNotAccepted(); }
fallback() external payable { revert DirectPaymentNotAccepted(); }
```

### 3.4 Validation rules (custom errors, in this order)
| Check | Custom error |
|---|---|
| `recipients.length == 0` | `NoRecipients()` |
| `recipients.length > MAX_RECIPIENTS` | `TooManyRecipients(uint256 count, uint256 max)` |
| `recipients.length != amounts.length` | `LengthMismatch(uint256 recipients, uint256 amounts)` |
| recipient is `address(0)` | `ZeroAddress(uint256 index)` |
| recipient is `address(this)` | `ContractAsRecipient(uint256 index)` |
| recipient is `msg.sender` | `SenderAsRecipient(uint256 index)` |
| amount is 0 | `ZeroAmount(uint256 index)` |
| duplicate recipient (O(n²) loop is fine for n ≤ 20; explain why in a comment) | `DuplicateRecipient(address recipient)` |
| `sum(amounts) != msg.value` | `IncorrectValue(uint256 sent, uint256 required)` |
| reentrant call | `ReentrantCall()` |
| any `call` returns false | `TransferFailed(address recipient, uint256 amount)` |
| ETH sent directly | `DirectPaymentNotAccepted()` |

Exact equality for `msg.value` (not `>=`) guarantees no ETH is ever left in the contract.

### 3.5 Execution order
1. Reentrancy lock check & set (a `bool private locked` modifier — hand-written, no OpenZeppelin, so Remix needs no imports).
2. All validation (checks).
3. `paymentId = ++paymentCount;` (effects).
4. Loop: `(bool ok, ) = recipients[i].call{value: amounts[i]}(""); if (!ok) revert TransferFailed(...)` (interactions). Use `call`, not `transfer`/`send` (2300-gas stipend breaks smart-contract wallets; explain in comments).
5. `emit PaymentSplit(paymentId, msg.sender, recipients, amounts, msg.value, block.timestamp);`
6. Unlock.

Comment in the contract why reentrancy is doubly safe here: the contract holds no balance and every call must bring its own exact ETH, plus the lock.

### 3.6 Helper contracts (tests only, in `contracts/test-helpers/`, never deployed to Sepolia)
- `RejectingReceiver`: `receive()` always reverts.
- `ReentrantReceiver`: in `receive()`, attempts to call `splitPayment` again; records whether the re-entry reverted.

---

## 4. Hardhat project

- Use the **current stable Hardhat** release with its **ethers v6 + Mocha/Chai** toolbox. Check versions with `npm view` before scaffolding and follow the current official Hardhat docs (Hardhat 3 changed config format, ESM, and secret handling vs Hardhat 2). Prefer whatever is stable and well-documented; do not fight the tooling — record the choice in `DECISIONS.md`.
- Networks: `hardhat` (in-process), `localhost` (`http://127.0.0.1:8545`, chainId 31337), `sepolia` (RPC URL + deployer key from env/Hardhat keystore — **never** hardcoded).
- `.env.example` documents: `SEPOLIA_RPC_URL` (Alchemy/Infura/public RPC), `SEPOLIA_PRIVATE_KEY` (a **dedicated throwaway dev account**, never the main one), optional `ETHERSCAN_API_KEY`. If the Hardhat version supports an encrypted keystore / configuration variables, prefer that and document it.
- Enable a **gas reporter** and **solidity-coverage** if they work with the chosen Hardhat version; include their output in `TEST_RESULTS.md`. Skip with a note if incompatible.
- npm scripts (exact names): `compile`, `test`, `coverage`, `node`, `deploy:local`, `deploy:sepolia`, `export-abi`, `demo:local`, `verify:sepolia` (optional).

### 4.1 Deploy script behaviour
- Deploys `SmartSplit`, waits for confirmation, logs address/tx hash/block.
- Writes `deployments/<network>.json` (address, chainId, deployer, txHash, blockNumber, timestamp).
- Copies ABI to `frontend/src/abi/SmartSplit.json` and updates `frontend/src/config/contracts.ts` with `{ address, deployBlock }` for that chainId.
- `export-abi` can also be run with manual args (`--address 0x... --block 1234 --chain 11155111`) to register a contract **deployed from Remix**.

### 4.2 Test suite (must all pass; target ≥ 95% line coverage of SmartSplit.sol)
Group with `describe` blocks:
- **Deployment:** `paymentCount == 0`, `MAX_RECIPIENTS == 20`, contract balance 0.
- **Successful splits:** 1 recipient; 3 equal recipients (balances change by exact amounts — use `changeEtherBalances`); unequal amounts; exactly 20 recipients; event emitted with exact args; `paymentCount` increments; contract balance stays 0 after.
- **Validation reverts** (each with `revertedWithCustomError` + args): no recipients, 21 recipients, length mismatch, zero address, contract-as-recipient, sender-as-recipient, zero amount, duplicate (also duplicate at non-adjacent positions), msg.value too low, msg.value too high, msg.value 0.
- **Failed transfer:** one recipient is `RejectingReceiver` → whole tx reverts with `TransferFailed`; **no** recipient balance changed (atomicity).
- **Reentrancy:** `ReentrantReceiver` as a recipient → re-entry blocked; tx outcome matches the documented behaviour.
- **Direct ETH:** plain send and call with unknown calldata both revert with `DirectPaymentNotAccepted`.
- **Smart-contract-wallet recipient:** a receiver contract that does a little work in `receive()` (more than 2300 gas) still gets paid (proves why `call` was chosen).
- **Gas sanity:** log gas used for 1, 3, 10, 20 recipients into `TEST_RESULTS.md`.

---

## 5. Frontend specification

### 5.1 Stack
React + Vite + TypeScript (strict) + Tailwind CSS (current stable; follow its current Vite install method) + ethers v6. Vitest for unit tests of `src/lib/*`. No UI component library required; a small icon set (e.g. lucide-react) is fine. No state library — React hooks are enough.

### 5.2 Money handling (critical)
- **All amounts are `bigint` wei internally.** Parse user input with `ethers.parseEther` only; never use JS floating-point math for ETH.
- Reject inputs with more than 18 decimals, negatives, scientific notation, empty strings.
- **Equal split:** `share = total / n` in wei; `remainder = total % n`; give +1 wei to the first `remainder` recipients so the sum equals `total` exactly. Show the per-recipient result. Unit-test this (e.g. 1 wei / 3, 0.03 ETH / 3, 0.1 ETH / 7).

### 5.3 Wallet (`useWallet`)
- Detect MetaMask absence → show "Install MetaMask" with link.
- `eth_requestAccounts` on Connect button only (never auto-pop on load); silently restore with `eth_accounts`.
- Show shortened address (copy button) and balance (refresh after each confirmed tx).
- Listen to `accountsChanged` and `chainChanged`; reset state appropriately (no page reload loops).
- Supported chains: 11155111 (Sepolia) and 31337 (Hardhat local, enabled only in dev or when configured). On unsupported chain, show a banner with **"Switch to Sepolia"** (`wallet_switchEthereumChain`; fall back to `wallet_addEthereumChain` for localhost in dev).
- If no contract address is configured for the current chain, show a clear message instead of a broken form.

### 5.4 Payment form
- Mode toggle: **Custom amounts** | **Equal split** (total + N recipients).
- Recipient rows: address input, optional label (local only, e.g. "Rahul"), amount input, remove button; "Add recipient" disabled at 20.
- Per-row live validation with messages: invalid address, bad checksum (mixed-case that fails checksum), zero address, the contract address, the sender's own address, duplicate (case-insensitive), invalid/zero amount.
- Summary panel: count, total in ETH, sender balance, warning if total + estimated gas > balance.
- **"Review payment"** opens a confirmation modal listing every full checksummed address and amount, the total, network name, and the contract address — the user must tick "I have checked the recipient addresses" before "Confirm in MetaMask" is enabled. (This is the "prevent paying an unintended recipient" safeguard.)
- Before sending, run `estimateGas` / `staticCall`; if it reverts, decode the custom error and show a human message instead of opening MetaMask.

### 5.5 Transaction status panel
States: `idle → awaiting-signature → pending (hash shown, Etherscan link) → confirmed (block number, gas used) | failed | rejected`.
- "Confirmed" is shown **only** after `tx.wait()` returns a receipt with `status === 1`.
- User rejection (`ACTION_REJECTED` / code 4001) → "You rejected the transaction in MetaMask. No ETH was sent."
- Decode contract custom errors via the ABI into plain English (map in `lib/errors.ts`).
- Etherscan link only on Sepolia: `https://sepolia.etherscan.io/tx/<hash>`; on local chain show the hash with "local network — no explorer".

### 5.6 Transaction history
- Source of truth: `PaymentSplit` events via `contract.queryFilter`, from the configured `deployBlock` to latest.
- **Query in block-range chunks** (e.g. 5,000 blocks, configurable) and handle RPC "range too large" errors by halving the chunk — MetaMask's RPC limits log ranges.
- Filter toggle: **My payments** (indexed `sender` = connected account) | **All payments**.
- Each row: payment ID, sender, recipients with amounts (expandable), total, timestamp (from event), tx hash + Etherscan link, "Confirmed" badge.
- Pending/failed transactions from **this browser session** may be shown in a separate "This session" list kept in memory/`sessionStorage` and clearly labelled — never mixed into the confirmed on-chain list.
- Refresh button; auto-refresh after a confirmed payment. Loading and empty states.

### 5.7 UI/UX
- Layout: header (app name, network badge, wallet button) → dashboard cards (wallet balance, network, contract address with Etherscan link, total payments count from `paymentCount`) → two-column (form | status + summary) → history below. Single column on mobile.
- Clean, professional, light theme (dark mode optional). Subtle transitions only, no heavy animation. Accessible labels, keyboard-usable modal, visible focus states.
- Small "Testnet only — no real money" badge.

### 5.8 Frontend checks
`npm run build` must succeed with zero TypeScript errors; `npm run lint` clean; `npm test` (Vitest) passing for `validation.ts`, `split.ts`, `format.ts`, `errors.ts`.

---

## 6. Remix integration (required)

Remix is used alongside Hardhat, not instead of it:

| Purpose | Tool |
|---|---|
| Writing, automated tests, coverage, gas reports, scripted deploys, ABI export | **Hardhat** (primary) |
| Live in-class demonstration of compiling, deploying, and calling the contract visually | **Remix** |
| **Recommended Sepolia deployment** (MetaMask signs; no private key ever leaves the wallet) | **Remix + Injected Provider (MetaMask)** |
| Interacting with the already-deployed Sepolia contract during viva ("At Address") | **Remix** |

Write `remix/REMIX_GUIDE.md` with exact, numbered steps:
1. Open remix.ethereum.org → create `SmartSplit.sol` → paste the contract (same file as Hardhat).
2. Solidity Compiler tab: version **0.8.28**, optimizer 200 runs (match Hardhat) → Compile.
3. Deploy & Run tab: Environment **"Remix VM"** → deploy → call `splitPayment` with example arrays (show exact formatting: `["0xabc...","0xdef..."]`, `["10000000000000000","10000000000000000"]`, and VALUE field = total in **wei** — explain the wei/Ether unit dropdown) → show event in the console log.
4. Switch Environment to **"Injected Provider – MetaMask"**, confirm Sepolia (11155111) → Deploy → confirm in MetaMask → copy address and the deployment block number from Etherscan.
5. Register it with the frontend: `npm run export-abi -- --address <addr> --block <block> --chain 11155111` (or edit `contracts.ts` manually — show both).
6. Use "At Address" to load the deployed contract, read `paymentCount`, show a call.
7. Optional: verify source on Etherscan (Remix Etherscan plugin or Hardhat `verify`), so viewers can read the code on Etherscan.
8. Troubleshooting: wrong compiler version, wei vs ether in VALUE, MetaMask on wrong network, "gas estimation failed" = a validation revert.

Also document: why the bytecode from Remix and Hardhat match when compiler version + optimizer settings match.

---

## 7. Build phases

Create a task list and work through these in order. After each phase, run the verification commands and record real results.

**Phase 1 — Scaffold.** Folders, git init, `.gitignore`, Hardhat project, Vite project, Tailwind, README skeleton. Verify: `npx hardhat compile` works on an empty/hello contract; `npm run build` in frontend works.

**Phase 2 — Contract + tests.** Implement §3 and §4.2. Verify: `npm test` all green, coverage report, gas report. Write results to `docs/TEST_RESULTS.md`. Fix until green — do not weaken tests to make them pass.

**Phase 3 — Scripts + local chain.** Deploy script, export-abi, demo-local script. Verify: start `npx hardhat node` (background), `deploy:local`, `demo:local` prints before/after balances proving the split. Record output.

**Phase 4 — Frontend.** Implement §5. Verify: Vitest green, typecheck, lint, production build. Run the dev server against the local node and smoke-check what can be checked without MetaMask (page renders, contract config loads, read-only `paymentCount` call via a JSON-RPC provider in a quick script). You cannot click MetaMask yourself — produce a **manual local test checklist** in `docs/TEST_RESULTS.md` for the student (import a Hardhat test account into MetaMask, add network localhost:8545 / 31337, do a 3-recipient split, check history; note: after restarting the Hardhat node, clear MetaMask activity/nonce data for that account).

**Phase 5 — Docs.** README, ARCHITECTURE.md, REMIX_GUIDE.md, REPORT.md, VIVA.md, DEMO_SCRIPT.md (see §8). Sepolia-specific values remain `<<FILL AFTER DEPLOY>>`.

🛑 **CHECKPOINT A — stop and report to the student:** summary of what was built, real test/build results, and the two Sepolia deployment options:
- **Option 1 (recommended): deploy via Remix + MetaMask** following REMIX_GUIDE.md, then run `export-abi` with the address and block.
- **Option 2: `npm run deploy:sepolia`** — requires the student to put an RPC URL and a *throwaway* account's key into `.env` (or Hardhat keystore) **themselves**. Never ask them to paste it into chat.
Wait for the student to say which and to confirm when done.

**Phase 6 — Sepolia integration.** After the student confirms deployment: register address/block, rebuild frontend, re-verify. Give the student a Sepolia test checklist: (1) 1 recipient 0.001 ETH, (2) 3-way equal split 0.003 ETH, (3) a deliberately invalid attempt (duplicate address) blocked by the UI, (4) a MetaMask rejection, (5) history shows the confirmed ones with working Etherscan links. Recipients can be the student's other MetaMask accounts (Account 2, 3…).

🛑 **CHECKPOINT B — student runs the Sepolia checklist** and reports tx hashes. Then fill `<<FILL AFTER DEPLOY>>` placeholders in docs (contract address, deploy tx, sample payment tx hashes) — only with values the student provided or you verified on-chain via a read script.

**Phase 7 — Final pass.** Fresh-clone check: delete `node_modules`, reinstall, rerun all tests and build from README instructions exactly. Confirm no secrets in git history (`git log -p | grep -i "private\|mnemonic"` style check). Final summary.

---

## 8. Documentation deliverables

- **README.md:** what it is, screenshot placeholder, prerequisites (Node LTS version, MetaMask), quick start (local), test commands, Sepolia deploy (both options), Remix pointer, project structure, troubleshooting (wrong network, nonce errors after node restart, RPC log-range errors, insufficient funds), safety notes.
- **docs/ARCHITECTURE.md:** Mermaid component diagram + Mermaid sequence diagram of one payment (User → UI → MetaMask → Contract → Recipients → Event → UI). If feasible, also render them to PNG/SVG for the report.
- **docs/REPORT.md** (college format, ~8–12 pages when printed): Title, Abstract, Introduction, Problem Statement, Objectives, Literature/Background (blockchain, Ethereum, smart contracts, gas, testnets, wallets — brief), System Architecture, Methodology & Tools, Implementation (contract walkthrough with key snippets, frontend modules), Security Considerations (reentrancy, CEI, exact value, atomicity, validation, key handling), Testing & Results (real numbers from TEST_RESULTS.md: test count, coverage %, gas per recipient count, Sepolia tx links), Limitations (20-recipient cap, all-or-nothing means one bad recipient blocks the payment, gas cost grows linearly, testnet only, no off-chain labels persistence, public transparency = no privacy), Future Scope (pull-payment pattern, ERC-20 support, recurring splits, L2 deployment), Conclusion, References. If `pandoc` is available, also export `REPORT.docx`.
- **docs/VIVA.md:** at least 25 questions with concise answers, grouped: blockchain basics; Ethereum/gas/testnets; Solidity specifics (`payable`, `msg.value`, `msg.sender`, `calldata`, events, custom errors, `call` vs `transfer`/`send`); security (reentrancy, CEI, why exact `msg.value`, what if a recipient reverts, push vs pull); this project's design choices (why no backend, why events for history, why cap 20, why wei/bigint in frontend, Hardhat vs Remix roles, how MetaMask signs without sharing the key); testing.
- **docs/DEMO_SCRIPT.md:** a timed (~5–7 min) script with what to say and click: intro → show contract in Remix (compile, explain) → open the app → connect MetaMask → show network check → enter 3 recipients / equal split 0.003 ETH → show validation catching a duplicate → review modal → confirm in MetaMask → pending → confirmed → open Etherscan (show internal transactions to recipients and the event log) → history panel → closing line. Include a pre-demo checklist (balance ≥ 0.05 ETH, Sepolia selected, backup tx hashes from earlier successful runs in case the testnet is slow).

---

## 9. Definition of done

- [ ] `SmartSplit.sol` compiles identically in Hardhat and Remix (0.8.28, optimizer 200).
- [ ] All contract tests pass; coverage ≥ 95% lines on SmartSplit.sol; results recorded.
- [ ] Local end-to-end demo script runs and proves correct balances.
- [ ] Frontend: typecheck, lint, unit tests, production build all pass.
- [ ] Remix guide complete and accurate.
- [ ] Sepolia contract deployed (by the student's action) and registered; checklist transactions confirmed on Etherscan.
- [ ] README, ARCHITECTURE, REPORT, VIVA (≥25), DEMO_SCRIPT, TEST_RESULTS, DECISIONS complete, with no fabricated values.
- [ ] No secrets in the repo; `.env.example` only.
