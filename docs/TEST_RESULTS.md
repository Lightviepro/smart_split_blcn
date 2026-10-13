# Test Results

All numbers below are copied from real command output. Nothing here is estimated or invented.
Sepolia values marked `<<FILL AFTER DEPLOY>>` are filled only with real, verified transactions.

**Environment:** macOS (Darwin 25.6), Node.js v22.19.0, npm 10.9.3, Hardhat 3.19.0, solc 0.8.28 (optimizer on, 200 runs, EVM target `cancun`).
**Recorded:** 2026-10-13.

---

## 1. Contract unit tests — `npm test` (in `contracts-hardhat/`)

**Result: 30 passing, 0 failing.**

```text
  SmartSplit
    Deployment
      ✔ starts with paymentCount == 0
      ✔ has MAX_RECIPIENTS == 20
      ✔ holds a balance of 0
    Successful splits
      ✔ pays a single recipient
      ✔ splits equally among 3 recipients with exact balance changes
      ✔ handles unequal amounts
      ✔ pays exactly 20 recipients (the maximum)
      ✔ emits PaymentSplit with the exact arguments
      ✔ increments paymentCount for each split and uses it as the paymentId
      ✔ keeps the contract balance at 0 after paying
    Validation reverts
      ✔ reverts with NoRecipients for an empty list
      ✔ reverts with TooManyRecipients for 21 recipients
      ✔ reverts with LengthMismatch when arrays differ in length
      ✔ reverts with ZeroAddress (and reports the index)
      ✔ reverts with ContractAsRecipient when the contract pays itself
      ✔ reverts with SenderAsRecipient when the sender pays themself
      ✔ reverts with ZeroAmount for a 0 wei amount
      ✔ reverts with DuplicateRecipient for adjacent duplicates
      ✔ reverts with DuplicateRecipient for non-adjacent duplicates
      ✔ reverts with IncorrectValue when msg.value is too low
      ✔ reverts with IncorrectValue when msg.value is too high
      ✔ reverts with IncorrectValue when msg.value is 0
      ✔ does not change paymentCount when a payment reverts
    Failed transfer (atomicity)
      ✔ reverts the whole payment with TransferFailed and changes no balances
    Reentrancy
      ✔ blocks re-entry with ReentrantCall; the outer payment completes
    Direct ETH
      ✔ rejects a plain ETH transfer (receive)
      ✔ rejects a call with unknown calldata (fallback)
    Smart-contract-wallet recipient
      ✔ pays a recipient whose receive() needs more than 2300 gas
      ✔ (contrast) the same recipient cannot be paid with transfer()'s 2300 gas stipend
    Gas sanity
      gas:  1 recipients -> 51862 (existing accounts), 87027 (new empty accounts)
      gas:  3 recipients -> 70876 (existing accounts), 143694 (new empty accounts)
      gas: 10 recipients -> 161877 (existing accounts), 411877 (new empty accounts)
      gas: 20 recipients -> 321925 (existing accounts), 821925 (new empty accounts)
      ✔ records gas used for 1, 3, 10 and 20 recipients


  30 passing (87ms)
```

## 2. Coverage — `npm run coverage`

Uses Hardhat 3's built-in coverage (`hardhat test mocha --coverage`). HTML report: `contracts-hardhat/coverage/html/index.html`.

```text
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                                    Coverage Report                                    ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║ File Coverage                                                                         ║
╟──────────────────────────────────────────────┬────────┬─────────────┬─────────────────╢
║ File Path                                    │ Line % │ Statement % │ Uncovered Lines ║
╟──────────────────────────────────────────────┼────────┼─────────────┼─────────────────╢
║ contracts/SmartSplit.sol                     │ 100.00 │ 100.00      │ -               ║
║ contracts/test-helpers/GasHeavyReceiver.sol  │ 100.00 │ 100.00      │ -               ║
║ contracts/test-helpers/ReentrantReceiver.sol │ 91.67  │ 90.91       │ 36              ║
║ contracts/test-helpers/RejectingReceiver.sol │ 100.00 │ 100.00      │ -               ║
╟──────────────────────────────────────────────┼────────┼─────────────┼─────────────────╢
║ Total                                        │ 97.78  │ 98.18       │                 ║
╚══════════════════════════════════════════════╧════════╧═════════════╧═════════════════╝
```

**SmartSplit.sol: 100% lines, 100% statements** (target was ≥ 95%). The one uncovered line in
`ReentrantReceiver.sol` (line 36) is the "re-entry succeeded" branch of the test helper, which
*should* never run because the reentrancy guard always blocks it.

> Note: gas numbers printed during the coverage run are higher because coverage instruments
> the bytecode. Use the numbers from `npm test` / `npm run gas` below.

## 3. Gas report — `npm run gas`

Uses Hardhat 3's built-in gas statistics (`hardhat test mocha --gas-stats`).

```text
╔═══════════════════════════════════════════════════════════════════════╗
║ contracts/SmartSplit.sol:SmartSplit                                   ║
╟───────────────────┬────────┬─────────┬────────┬────────┬──────────────╢
║ Function name     │ Min    │ Average │ Median │ Max    │ #calls       ║
╟───────────────────┼────────┼─────────┼────────┼────────┼──────────────╢
║ MAX_RECIPIENTS    │ 21268  │ 21268   │ 21268  │ 21268  │ 1            ║
║ paymentCount      │ 23323  │ 23323   │ 23323  │ 23323  │ 8            ║
║ splitPayment      │ 51862  │ 195476  │ 86394  │ 838053 │ 19           ║
╟───────────────────┼────────┼─────────┼────────┼────────┼──────────────╢
║ Deployment        │ Min    │ Average │ Median │ Max    │ #deployments ║
╟───────────────────┼────────┼─────────┼────────┼────────┼──────────────╢
║                   │ 426320 │ 426320  │ 426320 │ 426320 │ 1            ║
╟───────────────────┼────────┼─────────┴────────┴────────┴──────────────╢
║ Bytecode size     │ 1725   │                                          ║
╚═══════════════════╧════════╧══════════════════════════════════════════╝
```

The wide min/max range of `splitPayment` comes from the tests deliberately using anything from 1 to 20 recipients.

### Gas per recipient count (from the "Gas sanity" test)

| Recipients | Gas used: recipients already exist | Gas used: recipients are brand-new empty accounts |
|---:|---:|---:|
| 1  | 51,862  | 87,027  |
| 3  | 70,876  | 143,694 |
| 10 | 161,877 | 411,877 |
| 20 | 321,925 | 821,925 |

Interpretation:
- Cost grows **roughly linearly**: about **9,500 gas per extra recipient** going from 1→3, about 13,000 from 3→10, and about 16,000 from 10→20. The per-recipient cost rises a little because the O(n²) duplicate check and the calldata/event size grow with n.
- Paying an address that has never held ETH costs an extra **25,000 gas** per recipient. This is the EVM's account-creation charge, not something the contract does.
- The 1-recipient "new account" figure also includes the first write of `paymentCount` (0 → 1, a ~20,000-gas storage write).
- Even the worst case (20 brand-new recipients, about 822k gas) is a small fraction of an Ethereum block's gas limit (tens of millions of gas).
- Deployment costs 426,320 gas, and the runtime bytecode is 1,725 bytes.

---

## 4. Local chain: deploy + end-to-end demo

Run against a real `npx hardhat node` process (chainId 31337) on 2026-10-13.

### `npm run deploy:local`

```text
Network:  localhost (chainId 31337)
Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Balance:  10000.0 ETH
Deploying SmartSplit...
Tx hash:  0xa5a249d60b242e012547b1a9bdbb1411f1461cb2f174d6eaff2e33a6cd6a9491 (waiting for confirmation...)

SmartSplit deployed
  address:     0x5FbDB2315678afecb367f032d93F642f64180aa3
  block:       1
  gas used:    426320
  saved:       deployments/localhost.json
  ABI ->       ../frontend/src/abi/SmartSplit.json
  config ->    ../frontend/src/config/contracts.ts
```

(These are Hardhat's well-known local test accounts and a local-only transaction. They hold no real value.)

### `npm run demo:local` (first run, right after deploying)

```text
SmartSplit at 0x5FbDB2315678afecb367f032d93F642f64180aa3 on localhost
Splitting 0.03 ETH equally among 3 recipients

tx sent:      0x0040434a1b689b7babf5e822d6e2772638947990660c7a4713680de75f11c373
confirmed in block 2, gas used 86394

who                  | before                  | after                         | change
---------------------|-------------------------|-------------------------------|---------------------------
sender               | 9999.99952788390625 ETH | 9999.969443998676475346 ETH   | -0.030083885229774654 ETH
recipient 1 (0x7099…)| 10000.0 ETH             | 10000.01 ETH                  | 0.01 ETH
recipient 2 (0x3C44…)| 10000.0 ETH             | 10000.01 ETH                  | 0.01 ETH
recipient 3 (0x90F7…)| 10000.0 ETH             | 10000.01 ETH                  | 0.01 ETH
SmartSplit contract  | 0.0 ETH                 | 0.0 ETH                       | 0.0 ETH

PaymentSplit event: paymentId=1 total=0.03 ETH
paymentCount now: 1

✅ Verified: each recipient received exactly their share, the sender paid exactly
   0.03 ETH + 0.000083885229774654 ETH gas, and the contract balance is 0.
```

(The table is condensed from the script's `console.table` output. The values are unchanged.)

The script checks these balance equations itself and exits with an error if any of them fails:
- each recipient's balance change equals its share,
- `sender before − sender after = 0.03 ETH + gasUsed × gasPrice`,
- the contract balance is 0.

### `npm run export-abi` (manual registration, as used after a Remix deploy)

```text
$ npm run export-abi -- --address 0x5FbDB2315678afecb367f032d93F642f64180aa3 --block 1 --chain 31337
ABI exported -> …/frontend/src/abi/SmartSplit.json
Registered SmartSplit on chain 31337 at 0x5FbDB2315678afecb367f032d93F642f64180aa3 (block 1)
Config updated -> …/frontend/src/config/contracts.ts

$ npm run export-abi -- --address 0x123 --block 1 --chain 31337
Invalid address: 0x123

$ npm run export-abi -- --address 0x5FbD…0aa3 --block 1 --chain 1
Unsupported chain 1. Use 11155111 (Sepolia) or 31337 (Hardhat local).
```

`npm run deploy:sepolia` without credentials stops before sending anything:
*"You can define it using a plugin like hardhat-keystore, or set it as an environment variable."*

---

## 5. Frontend checks (in `frontend/`)

| Command | Result |
|---|---|
| `npm test` (Vitest) | **5 files, 44 tests passed**: `split`, `validation`, `format`, `errors`, `chunks` |
| `npm run typecheck` (`tsc -b`, `strict: true`) | **0 errors** |
| `npm run lint` (`oxlint --deny-warnings src`) | **0 warnings, 0 errors** |
| `npm run build` | **Succeeded**: `index.js` 531 kB (178 kB gzip), `index.css` 23 kB |
| `npm audit` (frontend and contracts-hardhat) | **0 vulnerabilities** |

Highlights of the unit tests:
- `equalSplit`: 1 wei / 3 → `[1, 0, 0]`; 0.03 ETH / 3 → exactly 0.01 ETH each; 0.1 ETH / 7 → the first 5 recipients get +1 wei and the sum is exact; a sweep over n = 1..20 always sums to the total, and shares never differ by more than 1 wei.
- `parseEthAmount` rejects `''`, `-1`, `1e-3`, 19 decimals, `1,5`, `0x10` and `0`.
- `validateAddress` rejects a mixed-case address with a wrong checksum, the zero address, the contract and the sender.
- `toFriendlyError` decodes every one of the 12 custom errors from raw revert data, including MetaMask's nested `error.data.data` format. It maps code 4001 and `ACTION_REJECTED` to *"You rejected the transaction in MetaMask. No ETH was sent."*
- `fetchInChunks` halves the block range on "range too large" errors (5000 → 2500 → 1250 → 625) and rethrows other errors.

### Read-only contract check through the frontend's generated config

A Node script loaded `frontend/src/config/contracts.ts` and `frontend/src/abi/SmartSplit.json` and called the contract through a JSON-RPC provider:

```text
config 31337 -> 0x5FbDB2315678afecb367f032d93F642f64180aa3 deployBlock 1
chainId: 31337
paymentCount(): 2
MAX_RECIPIENTS(): 20
PaymentSplit events since deployBlock: 2
```

### Browser smoke test against the local node (optional, `npm run e2e:local`)

This drives the real UI (Vite dev server) in headless Chrome. A small stand-in for `window.ethereum`
forwards requests to the local Hardhat node, whose test accounts are unlocked. **It does not
replace testing with real MetaMask** (see the checklist below), but it does exercise the full UI flow
against a real chain. Result: **26/26 checks passed.**

```text
PASS  No wallet: shows "MetaMask is required" + install link
PASS  No wallet: "Testnet only — no real money" badge
PASS  Unsupported chain: banner shown
PASS  Switch to Sepolia calls wallet_switchEthereumChain(0xaa36a7)
PASS  Not auto-connected on load (Connect button visible)
PASS  Dashboard shows contract config for 31337
PASS  History loads without connecting (All payments)
PASS  Connect shows shortened address
PASS  Duplicate address flagged (case-insensitive)
PASS  Sender's own address flagged
PASS  Bad checksum flagged
PASS  Equal split shows 0.01 ETH per recipient
PASS  Review modal: confirm disabled until checkbox ticked
PASS  Review modal lists full checksummed addresses, network, contract
PASS  Escape closes the modal
PASS  Status reaches "Confirmed" with block + gas used
PASS  Local chain: "Local network — no explorer"
PASS  Each recipient received exactly 0.01 ETH on-chain — 0.01, 0.01, 0.01
PASS  History panel auto-refreshed and lists Payment #7
PASS  "This session" list shows the confirmed tx
PASS  User rejection shows the exact message
PASS  Preflight decodes TransferFailed into plain English
PASS  No transaction was sent for the blocked payment
PASS  "My payments" shows only this sender's payments
PASS  Mobile (390px): no horizontal overflow
PASS  No uncaught page errors

26/26 checks passed
```

(Payment numbers keep increasing because each run sends real transactions to the same local node.)

The run saved these screenshots of the local app: `docs/images/local-before-connect.png`,
`local-review-modal.png`, `local-after-payment.png`, `local-mobile.png`.

Bugs this test found and fixed during development:
1. **History missed a just-confirmed payment.** ethers briefly caches `getBlockNumber()`, so the history refresh queried up to the previous block. Fixed by reading `eth_blockNumber` directly.
2. **Horizontal overflow on mobile.** A long address in an error message did not wrap. Fixed with `overflow-wrap: anywhere`.

---

## 6. Manual local test checklist with real MetaMask (for the student)

Claude cannot click MetaMask, so these steps must be done by hand. Tick each box.

**Setup (one time)**
1. Terminal 1: `cd contracts-hardhat && npm run node`. Leave it running. It prints 20 test accounts with their private keys. **These are public, well-known test keys. Never send real ETH to them.**
2. Terminal 2: `cd contracts-hardhat && npm run deploy:local`
3. Terminal 3: `cd frontend && npm run dev`, then open http://localhost:5173
4. MetaMask → network menu → **Add a network manually**:
   Network name `Hardhat Local`, RPC URL `http://127.0.0.1:8545`, Chain ID `31337`, Currency symbol `ETH`.
   (Or click "Use Hardhat Local" in the app's wrong-network banner. MetaMask will offer to add it.)
5. MetaMask → **Add account → Import account** → paste the private key of **Account #1** from Terminal 1's output
   (Hardhat's public test key, local use only). Optionally import Account #2 too.

**Checks**
- [ ] Page loads without a MetaMask popup. Clicking **Connect MetaMask** opens the popup, and after approving, the short address and balance (~10000 ETH) appear.
- [ ] Switching MetaMask to another network (e.g. Sepolia) changes the network badge with no page reload. Switching back works.
- [ ] Enter 3 recipients: the addresses of Accounts #2, #3 and #4 from Terminal 1. Choose **Equal split** with total `0.03`. Each row shows `0.01 ETH`.
- [ ] Type Account #2's address in a 4th row → "Duplicate of recipient #1". Remove that row.
- [ ] **Review payment** → the modal lists 3 full addresses, 0.03 ETH, "Hardhat Local (chain 31337)" and the contract address. "Confirm in MetaMask" is disabled until the checkbox is ticked.
- [ ] Confirm → MetaMask shows **0.03 ETH** to the contract → approve → the status goes Waiting for signature → Pending (hash shown) → **Confirmed** (block number, gas used).
- [ ] Wallet balance drops by about 0.03 ETH plus gas. Total payments goes up by 1. Payment history shows the new payment at the top.
- [ ] Make a 1-recipient payment and press **Reject** in MetaMask → *"You rejected the transaction in MetaMask. No ETH was sent."*
- [ ] History → **My payments** shows only payments from the connected account. **All payments** shows every payment.

**⚠️ After restarting `npm run node`:** the chain starts again from block 0, but MetaMask remembers the old
transaction count (nonce) and errors with "nonce too high" or hangs. Fix: MetaMask → Settings → Advanced →
**Clear activity tab data**. Then run `npm run deploy:local` again; the contract address will be the same,
`0x5FbD…0aa3`, because it depends only on the deployer and nonce.

---

## 7. Sepolia results

| Item | Value |
|---|---|
| Contract address | [`0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC`](https://sepolia.etherscan.io/address/0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC) |
| Deployment tx | [`0x6c73c4302d7043720142bcd0287006742904aaaa95ce1990955ea72eb9460ec6`](https://sepolia.etherscan.io/tx/0x6c73c4302d7043720142bcd0287006742904aaaa95ce1990955ea72eb9460ec6) |
| Deployment block | 11904281 (2026-10-13 06:28:36 UTC) |
| Deployed with | Remix IDE + MetaMask (Injected Provider), by the student |
| Gas used / fee | 2,875,494 gas × 1.5 gwei = **0.004313 Sepolia ETH** |

### On-chain verification (read-only script via a public Sepolia RPC, 2026-10-13)

```text
chainId: 11155111
receipt status: 1 | block: 11904281 | contractAddress: 0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC | gasUsed: 2875494 | from: 0x051A5B07e73e368EaA1cfB645220daC6E3C6644f
address matches: true | block matches: true
on-chain code bytes: 1725 | executable code identical to Hardhat build: true
paymentCount(): 0 | MAX_RECIPIENTS(): 20
contract balance (wei): 0
block timestamp: 2026-10-13T06:28:36.000Z
```

The code deployed from Remix is identical to the Hardhat build (all 1,725 bytes, compared with the metadata hash excluded, as explained in `remix/REMIX_GUIDE.md` §9). `frontend/src/config/contracts.ts` has `11155111: { address: "0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC", deployBlock: 11904281 }`, registered by the student with `npm run export-abi`.

### Sepolia gas is higher than the local chain

Deployment used **2,875,494 gas on Sepolia vs 426,320 on the local Hardhat chain** for the same bytecode. Sepolia's current network upgrade activated on **2026-10-06** (`eth_config` activation time 1791294816), and its block gas limit is now 200,000,000. Under its rules, creating state (new storage slots, new accounts, contract code) costs much more than under the `cancun` rules the local chain simulates. `eth_estimateGas` against the live contract (simulation only, nothing sent), each recipient getting 0.001 ETH:

| Payment on Sepolia (estimate) | Gas |
|---|---:|
| 1 recipient that already exists (includes the first-ever `paymentCount` write) | 260,295 |
| 1 brand-new recipient | 448,537 |
| 3 brand-new recipients | 852,184 |
| 20 brand-new recipients | 4,268,917 |

At 1.5 gwei, a 3-new-recipient payment costs about 0.0013 ETH in gas. Because of this, the frontend's "not enough ETH for gas" warning now uses a separate, higher upper bound on Sepolia: `300k + 230k × recipients` gas, unit-tested against the numbers above (DECISIONS #24).

### Checklist results

| # | Sepolia checklist test | Tx hash / result |
|---|---|---|
| 1 | 1 recipient, 0.001 ETH | `<<FILL AFTER DEPLOY>>` |
| 2 | 3-way equal split, 0.003 ETH | `<<FILL AFTER DEPLOY>>` |
| 3 | Duplicate address blocked by the UI (no tx) | `<<FILL AFTER DEPLOY>>` |
| 4 | Rejected in MetaMask (no tx) | `<<FILL AFTER DEPLOY>>` |
| 5 | History shows 1 and 2 with working Etherscan links | `<<FILL AFTER DEPLOY>>` |
