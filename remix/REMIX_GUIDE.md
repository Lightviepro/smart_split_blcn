# Remix guide: compile, demo and deploy SmartSplit

Remix IDE (https://remix.ethereum.org) is used **alongside** Hardhat:

| Purpose | Tool |
|---|---|
| Writing, automated tests, coverage, gas reports, scripted deploys, ABI export | **Hardhat** (`contracts-hardhat/`) |
| Live classroom demo: compile, deploy and call the contract visually | **Remix** (Remix VM) |
| **Recommended Sepolia deployment.** MetaMask signs, so no private key ever leaves the wallet | **Remix + Injected Provider (MetaMask)** |
| Interacting with the already-deployed Sepolia contract during the viva ("At Address") | **Remix** |

The contract file is the **same file** in both tools: `contracts-hardhat/contracts/SmartSplit.sol`. It has no imports, so pasting it alone into Remix is enough.

---

## 1. Create the file

1. Open **https://remix.ethereum.org**.
2. In the **File explorer** (first icon on the left), right-click `contracts` → **New File** → name it `SmartSplit.sol`.
3. Open `contracts-hardhat/contracts/SmartSplit.sol` on your computer, copy **all** of it, and paste it into the Remix file.

## 2. Compile with the same settings as Hardhat

1. Click the **Solidity Compiler** tab (second icon).
2. **Compiler:** choose **`0.8.28+commit.7893614a`**. The version must match the `pragma solidity 0.8.28;` line exactly.
3. Open **Advanced Configurations**:
   - Tick **Enable optimization** and set runs to **200**. Remix leaves optimization **off** by default, so you must turn it on to match Hardhat.
   - **EVM version:** leave on **default** (for 0.8.28 this is `cancun`, the same as Hardhat).
4. Click **Compile SmartSplit.sol**. A green tick appears on the tab icon.
5. Optional, for the viva: click **Compilation Details** → **ABI** to show the function, the event and the 12 custom errors.

## 3. Demo on the Remix VM (free, instant, no MetaMask)

1. Click the **Deploy & run transactions** tab (third icon).
2. **Environment:** choose **Remix VM** (any of the listed forks, e.g. *Remix VM (Cancun)*). This is a simulated blockchain inside your browser with 15 test accounts, each holding 100 fake ETH.
3. **Account:** leave the first account selected (this will be the **sender**). Open the account dropdown and copy two **other** addresses; these will be the recipients. The default Remix VM accounts are usually:
   - `0x5B38Da6a701c568545dCfcB03FcB875f56beddC4` (account 1, the sender)
   - `0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2` (account 2)
   - `0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db` (account 3)

   Always copy them from your own dropdown, in case your Remix version shows different ones.
4. **Contract:** `SmartSplit - contracts/SmartSplit.sol` → click **Deploy** (orange). It appears under **Deployed Contracts**.
5. Expand the deployed contract. Click **`paymentCount`** (blue, read-only) → `0`. Click **`MAX_RECIPIENTS`** → `20`.
6. Click the small arrow next to **`splitPayment`** (red, because it is `payable`) to show one field per parameter, and enter exactly:

   | Field | Value |
   |---|---|
   | `recipients` | `["0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2","0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db"]` |
   | `amounts` | `["10000000000000000","10000000000000000"]` |

   - Arrays use **square brackets**, every element in **double quotes**, separated by commas, with no spaces needed.
   - Amounts are in **wei**: 1 ETH = 1,000,000,000,000,000,000 (10¹⁸) wei, so **0.01 ETH = `10000000000000000`** (1 followed by 16 zeros).
7. Scroll up to the **VALUE** field (above the Deploy button) and enter the **total**, `20000000000000000`, with the unit dropdown next to it set to **Wei**.
   - **The unit dropdown matters.** The same total is `0.02` with the dropdown set to **Ether**. If you type `20000000000000000` while it says *Ether*, Remix will try to send 20 quadrillion ETH and fail.
   - The value must equal the sum of the amounts **exactly**, otherwise the contract reverts with `IncorrectValue`.
8. Click **transact**. In the console at the bottom, click the transaction line to expand it:
   - **status:** `0x1 Transaction mined and execution succeed`
   - **logs:** shows the `PaymentSplit` event with `paymentId: 1`, the sender, both recipients, both amounts, `total: 20000000000000000` and a timestamp.
   - The recipients' balances in the **Account** dropdown went up by 0.01 ETH each.
9. Click `paymentCount` again → `1`.
10. **Show a validation error (good for the viva):** put the same address twice in `recipients`, adjust the amounts and VALUE, and click **transact**. Remix shows the revert with the decoded custom error, `DuplicateRecipient` with the duplicated address. Other quick ones to try: VALUE too low → `IncorrectValue(sent, required)`; your own address (account 1) as a recipient → `SenderAsRecipient(0)`.

## 4. Deploy to Sepolia with MetaMask (recommended)

Before you start: MetaMask is on **Sepolia** and the account has some Sepolia ETH (the real deployment on 13 Oct 2026 used 2,875,494 gas, i.e. 0.0043 Sepolia ETH at 1.5 gwei; Sepolia's current gas rules make it much more expensive than the 426k gas on a local Hardhat chain).

1. In **Deploy & run transactions**, set **Environment** to **Injected Provider - MetaMask**.
2. MetaMask asks to connect → choose your account → **Connect**.
3. Check the line under Environment: it must say **Sepolia (11155111) network**. If it shows another network, switch to Sepolia in MetaMask first.
4. Make sure the contract was compiled with **0.8.28 + optimization 200** (step 2) and **SmartSplit** is selected in the *Contract* dropdown.
5. Click **Deploy** → MetaMask shows a contract deployment with **0 ETH** value plus a gas fee → **Confirm**.
6. Wait for the console to show the mined transaction (usually 10–30 seconds on Sepolia).
7. Record these two values (you need both):
   - **Contract address:** under *Deployed Contracts*, click the copy icon next to `SMARTSPLIT AT 0x…`.
   - **Deployment block number:** click the transaction in the Remix console → **view on etherscan**. On Etherscan, copy the **Block** number (e.g. `7123456`). Also keep the transaction hash for the report.

> No private key was typed anywhere: Remix asked MetaMask to sign, and MetaMask kept the key.

## 5. Register the deployed contract with the frontend

Option A, script (recommended). In a terminal:

```bash
cd contracts-hardhat
npm run export-abi -- --address 0xYOUR_CONTRACT_ADDRESS --block YOUR_DEPLOY_BLOCK --chain 11155111
```

Expected output:

```text
ABI exported -> …/frontend/src/abi/SmartSplit.json
Registered SmartSplit on chain 11155111 at 0xYOUR_CONTRACT_ADDRESS (block YOUR_DEPLOY_BLOCK)
Config updated -> …/frontend/src/config/contracts.ts
```

Option B, edit by hand. Open `frontend/src/config/contracts.ts` and add one line per chain, in this exact format:

```ts
export const CONTRACTS: Record<number, ContractDeployment> = {
  31337: { address: "0x5FbDB2315678afecb367f032d93F642f64180aa3", deployBlock: 1 },
  11155111: { address: "0xYOUR_CONTRACT_ADDRESS", deployBlock: YOUR_DEPLOY_BLOCK },
};
```

The ABI in `frontend/src/abi/SmartSplit.json` is already correct, because the Remix and Hardhat sources are identical. Then restart `npm run dev` (or rebuild with `npm run build`). With MetaMask on Sepolia, the dashboard now shows the contract address with an Etherscan link.

## 6. Use the deployed contract from Remix ("At Address")

Useful in the viva to show that the live contract is the same code:

1. Remix → **Deploy & run transactions**, Environment **Injected Provider - MetaMask** (Sepolia).
2. With **SmartSplit** selected in the *Contract* dropdown (it must be compiled), paste the Sepolia contract address into the **At Address** field and click **At Address**. Do **not** click Deploy.
3. Under *Deployed Contracts*, click **`paymentCount`** to read the live number of payments (no gas, no MetaMask popup, since it is a read).
4. To show a write call: `splitPayment` with one recipient (e.g. your MetaMask *Account 2*), `amounts` `["1000000000000000"]` (0.001 ETH), VALUE `1000000000000000` **Wei** → **transact** → confirm in MetaMask. The payment then also appears in the web app's history, because the history comes from the contract's events.

## 7. Optional: verify the source code on Etherscan

Verification lets anyone read the contract's source code on Etherscan (a green ✓ on the *Contract* tab).

- **Deployed with Remix → verify with Remix.** Open the **Plugin manager** → activate **Contract Verification** (or the Etherscan plugin) → choose Etherscan / Sepolia, paste the contract address, select `SmartSplit.sol`, and enter an Etherscan API key (free at https://etherscan.io/myapikey).
- **Deployed with Hardhat → verify with Hardhat.** Set `ETHERSCAN_API_KEY` (keystore or `.env`), then run `npm run verify:sepolia -- 0xYOUR_CONTRACT_ADDRESS`.

Use the **same tool for deploying and verifying**. The reason is the metadata hash explained in §9.

## 8. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `ParserError: Source file requires different compiler version` | The compiler dropdown isn't **0.8.28**. Select `0.8.28+commit.7893614a`. |
| Bytecode or gas differs from Hardhat | Optimization isn't enabled with **200** runs. Tick *Enable optimization*, set 200, and recompile. |
| `IncorrectValue(sent, required)` | VALUE does not equal the sum of `amounts`. Most often the unit dropdown is wrong: amounts are in **wei**, so set VALUE's unit to **Wei** (or convert, e.g. 0.02 **Ether**). |
| Huge number error / "insufficient funds" on a tiny payment | The wei number was typed with the unit set to **Ether**. Switch the unit to **Wei**. |
| `Gas estimation failed … execution reverted` popup | The contract would **revert**. This is one of the validation rules (duplicate, zero amount, wrong VALUE, sender as recipient, …). Open the console for the decoded custom error. Don't press "Send transaction" anyway; it would fail and still cost gas. |
| Environment shows a network other than Sepolia (11155111) | MetaMask is on the wrong network. Switch to **Sepolia** in MetaMask. Remix updates automatically. |
| "At Address" button is greyed out | The contract isn't compiled in this Remix session, or *SmartSplit* isn't selected in the Contract dropdown. |
| Array input error | Use `["0x…","0x…"]` with double quotes and square brackets. Amounts must be quoted strings of digits, with no decimals and no `e18`. |

## 9. Why the bytecode from Remix and Hardhat matches

A Solidity compiler is **deterministic**: the same source code + the same compiler version + the same settings (optimizer on/off, runs, EVM version) always produce the same machine code. Both tools use **solc 0.8.28** with **optimizer on, 200 runs** and **EVM `cancun`**, so the executable bytecode is identical.

**We checked this:** compiling `SmartSplit.sol` with solc-js 0.8.28 (the JavaScript build of the compiler that Remix runs in your browser) as the single file `contracts/SmartSplit.sol`, as in Remix, with optimizer 200, gives runtime bytecode identical to Hardhat's artifact in all **1,672 bytes of executable code**. See `docs/DECISIONS.md` #11.

The only part that differs is the **last 53 bytes**, the *metadata hash*. solc appends a hash of a "metadata" JSON file that includes the **source file path**: `contracts/SmartSplit.sol` in Remix vs `project/contracts/SmartSplit.sol` inside Hardhat 3. That tail is never executed. It only identifies which exact source produced the code, which is also why you should verify on Etherscan with the same tool you deployed with.
