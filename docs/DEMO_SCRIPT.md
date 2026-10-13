# Live demo script — Smart Split (about 6 minutes)

**Say** = what to say · **Do** = what to click. Amounts are tiny on purpose (Sepolia test ETH).

---

## Pre-demo checklist (the day before, and again 15 minutes before)

- [ ] MetaMask unlocked, network **Sepolia**, main demo account balance **≥ 0.05 Sepolia ETH**.
- [ ] MetaMask has **Account 2, Account 3 and Account 4** (the recipients). Their addresses are copied into a text file, ready to paste.
- [ ] `frontend` running (`npm run dev`, or `npm run preview` after `npm run build`) at http://localhost:5173. The dashboard shows the **Sepolia contract address** (not "not deployed").
- [ ] History loads and shows earlier payments (proves the RPC is fine today).
- [ ] Remix open in a second tab with `SmartSplit.sol` pasted and **compiled with 0.8.28, optimizer 200**.
- [ ] Etherscan open in a third tab on the contract address: https://sepolia.etherscan.io/address/0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC
- [ ] **Backup tx hashes** from earlier successful runs, to show if the testnet is slow today:
  - 1-recipient payment: `<<FILL AFTER DEPLOY>>`
  - 3-way equal split: `<<FILL AFTER DEPLOY>>`
- [ ] Backup plan B if Sepolia is down: local chain (`npm run node` → `npm run deploy:local` → MetaMask on Hardhat Local), or the screenshots in `docs/images/`.
- [ ] Close other MetaMask popups. Browser zoom 110–125% so the room can read it.

---

## 0:00–0:30 · Introduction

**Say:** "Splitting a bill in crypto normally means sending several separate transactions. Each one needs approval, each one costs gas, and if one fails you're left half-paid. **Smart Split** does it in **one** transaction. A smart contract receives the total and forwards each person's share in the same transaction: either everyone gets paid or nobody does. There is no server and no database. The contract is the backend, and its events are the history. Everything runs on the Sepolia testnet with test ETH."

## 0:30–1:45 · The contract in Remix

**Do:** Switch to the Remix tab → open `SmartSplit.sol`.

**Say** (scroll while talking):
- "One function, `splitPayment`, takes a list of recipients and a list of amounts, and it's `payable`, so the total ETH comes with the call."
- "It follows **checks–effects–interactions**: first every rule is checked (1 to 20 recipients, no zero address, no duplicates, no zero amounts), and the ETH sent must **exactly** equal the sum, so the contract never keeps any ETH."
- "Then it updates its own counter, and only then sends the money using `call`, not `transfer`, so smart-contract wallets can receive too."
- "If any single transfer fails, the whole transaction reverts. There's also a reentrancy lock."
- "Errors are custom errors, like `DuplicateRecipient`, which the website turns into plain English."

**Do:** Solidity Compiler tab → show **0.8.28** and **optimization 200** → click **Compile** (green tick).

**Say:** "The same file and the same compiler settings are used in Hardhat, where 30 automated tests cover it with 100% line coverage."

## 1:45–2:15 · Open the app, connect, network check

**Do:** Switch to the app tab. Point at the **"Testnet only — no real money"** badge and the dashboard cards.

**Say:** "This is the web app. It talks to the blockchain only through MetaMask, so my private key never leaves the wallet."

**Do:** Click **Connect MetaMask** → approve in MetaMask. Show the short address, the copy button and the balance.

**Do (optional, 10 s):** In MetaMask switch to another network → the app shows **"Wrong network"** with **Switch to Sepolia** → click it → back to Sepolia.

**Say:** "If I'm on the wrong network, the app won't let me send. It offers to switch."

## 2:15–3:15 · Build a payment, show validation

**Do:** Click **Equal split**. Total: `0.003`. Paste **Account 2** in recipient #1 → **Add recipient** → paste **Account 3** → **Add recipient** → paste **Account 2 again**.

**Say:** "Look: it immediately says **'Duplicate of recipient #1'**. The contract would reject this too, but the app catches it first, so I don't waste gas."

**Do:** Replace the duplicate with **Account 4**. Each row now shows **0.001 ETH**.

**Say:** "Amounts are handled as whole numbers of wei, never floating point, so the shares always add up to exactly the total. If the total doesn't divide evenly, the first recipients get one extra wei."

**Do:** Point at the **Summary** card: 3 recipients, 0.003 ETH, estimated gas, balance.

## 3:15–4:15 · Review, confirm, pending → confirmed

**Do:** Click **Review payment**.

**Say:** "Before anything is sent I see every **full** address, every amount, the network and the contract address. I have to tick **'I have checked the recipient addresses'**, because blockchain payments can't be reversed."

**Do:** Tick the box → **Confirm in MetaMask** → in MetaMask show **0.003 ETH** + gas fee → **Confirm**.

**Say** (status panel shows *Pending* with the hash): "It's **pending**. The transaction is broadcast and waiting to be included in a block. The app only says **confirmed** once the receipt arrives."

**Do:** Wait for **Confirmed** (block number, gas used, payment number).

**Say:** "Confirmed, in block number … *(read it out)*, using … gas *(read it out)*. That's one transaction for three people. The balance and the total-payments counter updated too."

*(If Sepolia is slow, keep talking about the code or Etherscan, or open a backup tx hash.)*

## 4:15–5:15 · Etherscan proof

**Do:** Click **View on Etherscan**.

**Say / Do:**
- "Status: Success. **From** is me, **To** is the SmartSplit contract, **Value** is 0.003 ETH."
- Open the **Internal Transactions** tab: "These are the contract paying each recipient 0.001 ETH, three transfers inside one transaction."
- Open the **Logs** tab: "This is the `PaymentSplit` event with the payment ID, sender, recipients, amounts and total. This event is what the app's history reads."

## 5:15–5:45 · History

**Do:** Back in the app, scroll to **Payment history** → expand the newest payment. Toggle **My payments** / **All payments**.

**Say:** "There's no database here. The history is rebuilt from the contract's events, straight from the blockchain. Every entry links to Etherscan, and **My payments** filters by the indexed sender field."

## 5:45–6:00 · Closing line

**Say:** "So: one approval, one transaction, exact amounts, all-or-nothing safety, no server and full transparency. That's Smart Split. Thank you, I'm happy to take questions."

---

### Optional extras if time allows (viva)
- **Rejection:** start a payment and press **Reject** in MetaMask → "You rejected the transaction in MetaMask. No ETH was sent."
- **Remix At Address:** load the live Sepolia contract and click `paymentCount` (REMIX_GUIDE.md §6).
- **Remix VM:** show a `DuplicateRecipient` revert decoded in the Remix console (REMIX_GUIDE.md §3 step 10).
- **Tests:** `cd contracts-hardhat && npm test` → 30 passing in about 1 second.
