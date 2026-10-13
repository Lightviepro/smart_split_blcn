# Smart Split

**Split one ETH payment among several people in a single transaction.** Smart Split is a dApp built on a Solidity smart contract. Send ETH once and the contract forwards the exact amount you chose to each recipient (up to 20) in the same transaction. Either everyone is paid, or nobody is.

> 🧪 **Testnet only — no real money.** Runs on the Ethereum **Sepolia** testnet (chainId 11155111) and on a local Hardhat chain (31337) for development. It never connects to mainnet.

![Smart Split screenshot (local chain)](docs/images/local-after-payment.png)
<!-- Replace with a Sepolia screenshot after deployment: docs/images/sepolia-app.png -->

Blockchain Lab project · Solidity · Hardhat 3 · Remix IDE · React + Vite + TypeScript + Tailwind · ethers.js v6 · MetaMask

---

## Contents
- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Quick start (local chain)](#quick-start-local-chain)
- [Tests](#tests)
- [Deploying to Sepolia](#deploying-to-sepolia)
- [Remix](#remix)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Safety notes](#safety-notes)
- [Documentation](#documentation)

## How it works

1. You enter recipients and amounts (or a total for an **equal split**). The app checks every address and amount, and you confirm them in a review screen.
2. MetaMask asks you to sign **one** transaction calling `splitPayment(recipients, amounts)` with `value = total`.
3. The contract checks the rules (1–20 unique recipients, no zero address, no zero amounts, value exactly equal to the sum, …), then sends each amount. If any transfer fails, the whole transaction is reverted.
4. The contract emits a `PaymentSplit` event. The app's **history is read directly from these events**, so there is no backend server and no database.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **22 LTS, 22.18 or newer** (built with v22.19.0) | Hardhat 3 needs Node 22+. The `export-abi` script uses Node's built-in TypeScript support (22.18+). Check with `node -v`. |
| npm | 10+ | comes with Node |
| **MetaMask** | latest browser extension | https://metamask.io/download/ |
| Git | any | |
| Google Chrome | optional | only for the optional `npm run e2e:local` browser smoke test |

## Quick start (local chain)

Open **three terminals** in the project folder.

```bash
# Terminal 1 — install and start a local blockchain (leave it running)
cd contracts-hardhat
npm install
npm run node
```

```bash
# Terminal 2 — deploy the contract and run the scripted demo
cd contracts-hardhat
npm run deploy:local     # deploys, writes deployments/localhost.json, updates the frontend config + ABI
npm run demo:local       # splits 0.03 ETH among 3 accounts and prints balances before/after
```

```bash
# Terminal 3 — start the web app
cd frontend
npm install
npm run dev              # open http://localhost:5173
```

Then connect MetaMask to the local chain:
1. MetaMask → *Add a network manually*: name `Hardhat Local`, RPC `http://127.0.0.1:8545`, chain ID `31337`, symbol `ETH`. (Or click **Use Hardhat Local** in the app's wrong-network banner.)
2. MetaMask → *Add account → Import account* → paste the private key of **Account #1** printed by `npm run node`. These keys are public test keys. Use them **only** on the local chain.
3. Click **Connect MetaMask** in the app and make a payment to Accounts #2, #3, #4.

The full manual checklist is in [docs/TEST_RESULTS.md §6](docs/TEST_RESULTS.md#6-manual-local-test-checklist-with-real-metamask-for-the-student).

## Tests

```bash
cd contracts-hardhat
npm test              # 30 Mocha/Chai tests for the contract
npm run coverage      # coverage report (SmartSplit.sol: 100% lines)
npm run gas           # gas usage table
npm run typecheck     # TypeScript check of tests and scripts

cd ../frontend
npm test              # 44 Vitest unit tests (validation, split, format, errors, chunks)
npm run typecheck     # tsc, strict mode
npm run lint          # oxlint, warnings are errors
npm run build         # production build -> frontend/dist
npm run e2e:local     # OPTIONAL: headless-Chrome UI smoke test against the local node
```

Real results: [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md).

## Deploying to Sepolia

You need some Sepolia test ETH in MetaMask (a faucet such as https://cloud.google.com/application/web3/faucet/ethereum/sepolia). Deployment cost **2,875,494 gas (0.0043 Sepolia ETH at 1.5 gwei)** on Sepolia in October 2026. That's much more than the 426,320 gas measured on the local chain, because of Sepolia's newer gas rules (see [docs/TEST_RESULTS.md §7](docs/TEST_RESULTS.md#7-sepolia-results)).

### Option 1 (recommended): Remix + MetaMask
No private key ever leaves MetaMask. Follow [remix/REMIX_GUIDE.md](remix/REMIX_GUIDE.md) §4, then register the contract with the frontend:

```bash
cd contracts-hardhat
npm run export-abi -- --address 0xYOUR_CONTRACT --block YOUR_DEPLOY_BLOCK --chain 11155111
```

### Option 2: Hardhat script
Requires an RPC URL and the private key of a **dedicated throwaway account** that you set up **yourself** (never your main account, never pasted into a chat):

```bash
cd contracts-hardhat
# Preferred: encrypted Hardhat keystore (asks for a password)
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
# …or copy .env.example to .env and fill it in (.env is git-ignored)

npm run deploy:sepolia   # deploys, waits 2 confirmations, updates the frontend config + ABI
```

Afterwards: `cd frontend && npm run build` (or restart `npm run dev`), and switch MetaMask to Sepolia.

| Sepolia deployment | |
|---|---|
| Contract address | [`0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC`](https://sepolia.etherscan.io/address/0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC) |
| Deployment tx | [`0x6c73c430…b9460ec6`](https://sepolia.etherscan.io/tx/0x6c73c4302d7043720142bcd0287006742904aaaa95ce1990955ea72eb9460ec6) |
| Deploy block | 11904281 |
| Deployed with | Remix IDE + MetaMask, 13 Oct 2026 |

## Remix

Remix is used for the **visual demo** (compile → deploy on Remix VM → call `splitPayment` → see the event), for the **recommended Sepolia deployment**, and for calling the live contract with **At Address** during the viva. The contract file is the same one Hardhat uses, compiled with the same compiler (0.8.28, optimizer 200 runs). Step-by-step: [remix/REMIX_GUIDE.md](remix/REMIX_GUIDE.md).

## Project structure

```
.
├── README.md
├── SMART_SPLIT_SPEC.md              the build specification
├── contracts-hardhat/               Hardhat 3 project
│   ├── contracts/SmartSplit.sol     THE contract (no imports, Remix-friendly)
│   ├── contracts/test-helpers/      RejectingReceiver, ReentrantReceiver, GasHeavyReceiver (tests only)
│   ├── test/SmartSplit.test.ts      30 tests
│   ├── scripts/deploy.ts            deploy + write deployments/<network>.json + export ABI/config
│   ├── scripts/export-abi.ts        ABI + manual registration (after a Remix deploy)
│   ├── scripts/demo-local.ts        scripted end-to-end split with before/after balances
│   ├── deployments/                 <network>.json deployment records
│   ├── hardhat.config.ts
│   └── .env.example
├── frontend/                        React + Vite + TypeScript + Tailwind + ethers v6
│   ├── src/config/contracts.ts      chainId → { address, deployBlock } (generated)
│   ├── src/abi/SmartSplit.json      ABI (generated)
│   ├── src/lib/                     pure logic + Vitest tests
│   ├── src/hooks/                   useWallet, useSmartSplit, usePaymentHistory, useAsyncData
│   ├── src/components/              UI
│   └── e2e/ui-smoke.mjs             optional browser smoke test
├── remix/REMIX_GUIDE.md
└── docs/                            ARCHITECTURE, REPORT, VIVA, DEMO_SCRIPT, TEST_RESULTS, DECISIONS, images/
```

## Troubleshooting

| Problem | Fix |
|---|---|
| **"Wrong network"** banner | Click **Switch to Sepolia** (or switch in MetaMask). In `npm run dev`, Hardhat Local (31337) is also accepted. |
| **"SmartSplit is not deployed on … yet"** | No address is configured for this chain. Run `npm run deploy:local` (local), or deploy to Sepolia and run `npm run export-abi -- --address … --block … --chain 11155111`. Then restart the dev server. |
| **Nonce errors / transaction stuck after restarting `npm run node`** | The local chain was reset but MetaMask remembers old transactions. MetaMask → Settings → Advanced → **Clear activity tab data**. Then run `npm run deploy:local` again. |
| `demo:local` says "No contract code at …" | The node was restarted. Run `npm run deploy:local` again. |
| **History says "block range too large" / loads slowly** | Some RPC providers limit `eth_getLogs` ranges. The app already queries in 5,000-block chunks and halves the chunk on such errors. Set a smaller start size with `VITE_LOG_CHUNK_SIZE=1000` in `frontend/.env.local`. Make sure `deployBlock` in `contracts.ts` is the real deployment block, not 0. |
| **"Your wallet does not have enough ETH…"** / insufficient funds | You need the total **plus gas**. Get Sepolia ETH from a faucet, or use smaller amounts (0.001 ETH works). |
| **"Blocked before sending"** | The app simulated the payment and the contract would reject it. The message tells you why (e.g. a recipient contract refuses ETH). No ETH was sent. |
| `npm install` fails with `EACCES` in `~/.npm` | Your npm cache has root-owned files: `sudo chown -R $(id -u):$(id -g) ~/.npm`. |
| `export-abi` fails with a TypeScript syntax error | Node is older than 22.18. Upgrade Node. |

## Safety notes

- **Never share a seed phrase or private key**: not in chat, email, screenshots or commits. This project never asks for one.
- For `deploy:sepolia`, use a **dedicated throwaway account** with only a little test ETH. `.env` is git-ignored; only `.env.example` is committed. The encrypted Hardhat keystore is preferred.
- The Hardhat node's accounts (printed by `npm run node`) are **publicly known**. Never use them on a real network.
- Blockchain transactions **cannot be undone**. That's why the app shows full checksummed addresses in a review screen and requires you to tick "I have checked the recipient addresses".
- Everything on-chain is **public**: anyone can see who paid whom and how much. Recipient labels stay in your browser only.
- The contract has **no owner, no admin, no fees, and no upgrade mechanism**. Nobody can change its rules or take funds, and it never holds funds anyway.

## Documentation

| Document | What's inside |
|---|---|
| [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | Beginner walkthrough of the whole codebase, function by function |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Component + sequence diagrams (Mermaid, also as SVG/PNG in `docs/images/`) |
| [docs/REPORT.md](docs/REPORT.md) | College project report |
| [docs/VIVA.md](docs/VIVA.md) | Viva questions and answers |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | Timed live demo script + pre-demo checklist |
| [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) | Real test, coverage, gas and demo output; manual checklists |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Deviations from the spec and why |
| [remix/REMIX_GUIDE.md](remix/REMIX_GUIDE.md) | Remix workflow, Sepolia deployment, troubleshooting |
