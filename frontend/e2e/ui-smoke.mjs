// OPTIONAL headless-Chrome smoke test of the UI against the LOCAL Hardhat node.
//
// It is NOT a replacement for testing with real MetaMask (see docs/TEST_RESULTS.md checklist).
// A tiny stand-in for MetaMask's window.ethereum forwards JSON-RPC to the local node, whose
// built-in test accounts are unlocked, so eth_sendTransaction works with no private key here.
//
// Prereqs (3 terminals):  contracts-hardhat: npm run node  +  npm run deploy:local
//                         frontend: npm run dev
// Run:                    cd frontend && npm run e2e:local
//   (installs puppeteer-core temporarily with --no-save; it is not a project dependency)
// Chrome path: set CHROME_PATH if Chrome is not in the default macOS location.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Contract, ContractFactory, formatEther, getAddress, JsonRpcProvider, parseEther } from 'ethers'
import puppeteer from 'puppeteer-core'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const RPC = 'http://127.0.0.1:8545'
const APP = process.env.APP_URL ?? 'http://localhost:5173/'
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/images')
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const rpc = new JsonRpcProvider(RPC)
const accounts = (await rpc.send('eth_accounts', [])).map((a) => getAddress(a)) // node returns lowercase
const SENDER = accounts[5]
const [R1, R2, R3] = [accounts[6], accounts[7], accounts[8]]

// Deploy a recipient that rejects ETH, to exercise the "blocked before sending" path.
const art = JSON.parse(readFileSync(path.join(ROOT, 'contracts-hardhat/artifacts/contracts/test-helpers/RejectingReceiver.sol/RejectingReceiver.json'), 'utf8'))
const rejecting = await (await new ContractFactory(art.abi, art.bytecode, await rpc.getSigner(accounts[9])).deploy()).waitForDeployment()
const REJECTING = await rejecting.getAddress()

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
}

function mockEthereum(sender, rpcUrl, chainIdHex) {
  const listeners = {}
  let connected = false
  window.__rejectNext = false
  window.ethereum = {
    isMetaMask: true,
    on(e, f) { (listeners[e] ??= []).push(f) },
    removeListener(e, f) { listeners[e] = (listeners[e] ?? []).filter((x) => x !== f) },
    async request({ method, params }) {
      if (method === 'eth_chainId' && chainIdHex) return chainIdHex
      if (method === 'eth_accounts') return connected ? [sender] : []
      if (method === 'eth_requestAccounts') { connected = true; return [sender] }
      if (method === 'wallet_switchEthereumChain') { window.__switchedTo = params[0].chainId; return null }
      if (method === 'eth_sendTransaction' && window.__rejectNext) {
        window.__rejectNext = false
        throw Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { code: 4001 })
      }
      const res = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params ?? [] }) })
      const json = await res.json()
      if (json.error) throw Object.assign(new Error(json.error.message), { code: json.error.code, data: json.error.data })
      return json.result
    },
  }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] })
const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, s, timeout = 15000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, s)

try {
  // 1. No MetaMask installed
  {
    const page = await browser.newPage()
    await page.goto(APP, { waitUntil: 'networkidle0' })
    const t = await text(page)
    check('No wallet: shows "MetaMask is required" + install link', t.includes('MetaMask is required') && t.includes('Install MetaMask'))
    check('No wallet: "Testnet only — no real money" badge', t.toLowerCase().includes('testnet only — no real money'))
    await page.close()
  }

  // 2. Wrong network (mainnet chainId reported) — never auto-connects
  {
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(mockEthereum, SENDER, RPC, '0x1')
    await page.goto(APP, { waitUntil: 'networkidle0' })
    await waitText(page, 'Wrong network')
    check('Unsupported chain: banner shown', (await text(page)).includes('Wrong network: Chain 1'))
    const [btn] = await page.$$('xpath/.//button[contains(., "Switch to Sepolia")]')
    await btn.click()
    await new Promise((r) => setTimeout(r, 300))
    check('Switch to Sepolia calls wallet_switchEthereumChain(0xaa36a7)', (await page.evaluate(() => window.__switchedTo)) === '0xaa36a7')
    await page.close()
  }

  // 3. Main flow on Hardhat Local
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await page.evaluateOnNewDocument(mockEthereum, SENDER, RPC, null)
  await page.goto(APP, { waitUntil: 'networkidle0' })
  await waitText(page, 'Hardhat Local')
  let t = await text(page)
  check('Not auto-connected on load (Connect button visible)', t.includes('Connect MetaMask'))
  const cfg = readFileSync(path.join(ROOT, 'frontend/src/config/contracts.ts'), 'utf8').match(/31337:\s*\{\s*address:\s*"(0x[0-9a-fA-F]{40})"/)[1]
  check('Dashboard shows contract config for 31337', t.includes(`${cfg.slice(0, 6)}…${cfg.slice(-4)}`))
  check('History loads without connecting (All payments)', t.includes('Payment #1'))
  await page.screenshot({ path: `${SHOTS}/local-before-connect.png`, fullPage: true })

  const [connectBtn] = await page.$$('xpath/.//button[contains(., "Connect MetaMask")]')
  await connectBtn.click()
  await waitText(page, SENDER.slice(0, 6))
  check('Connect shows shortened address', (await text(page)).includes(`${SENDER.slice(0, 6)}…${SENDER.slice(-4)}`))
  await page.waitForFunction(() => /\d+(\.\d+)? ETH/.test(document.body.innerText))

  const addrInputs = () => page.$$('input[placeholder="0x… recipient address"]')
  const amountInputs = () => page.$$('input[placeholder="0.001"]')
  const clickButton = async (label) => { const [b] = await page.$$(`xpath/.//button[contains(., "${label}")]`); await b.click() }
  const setValue = async (el, value) => { await el.click({ clickCount: 3 }); await el.press('Backspace'); await el.type(value) }

  // Validation: duplicate (case-insensitive), own address, bad checksum
  await (await addrInputs())[0].type(R1)
  await clickButton('Add recipient')
  await (await addrInputs())[1].type(R1.toLowerCase())
  check('Duplicate address flagged (case-insensitive)', (await text(page)).includes('Duplicate of recipient #1'))
  await setValue((await addrInputs())[1], SENDER)
  check("Sender's own address flagged", (await text(page)).includes('This is your own connected address'))
  const badChecksum = R2.slice(0, 2) + [...R2.slice(2)].map((c) => (/[a-f]/.test(c) ? c.toUpperCase() : /[A-F]/.test(c) ? c.toLowerCase() : c)).join('')
  await setValue((await addrInputs())[1], badChecksum)
  check('Bad checksum flagged', (await text(page)).includes('Checksum mismatch'))
  await setValue((await addrInputs())[1], R2)
  await clickButton('Add recipient')
  await (await addrInputs())[2].type(R3)

  // Equal split 0.03 ETH / 3
  await clickButton('Equal split')
  await page.type('#equal-total', '0.03')
  t = await text(page)
  check('Equal split shows 0.01 ETH per recipient', (t.match(/0\.01 ETH/g) ?? []).length >= 3)

  // Review modal gate
  await clickButton('Review payment')
  await page.waitForSelector('[role="dialog"]')
  const confirmDisabled = await page.$eval('xpath/.//button[contains(., "Confirm in MetaMask")]', (b) => b.disabled)
  check('Review modal: confirm disabled until checkbox ticked', confirmDisabled === true)
  const modalText = await page.$eval('[role="dialog"]', (d) => d.innerText)
  check('Review modal lists full checksummed addresses, network, contract', [R1, R2, R3, 'Hardhat Local', cfg].every((s) => modalText.includes(s)))
  await page.screenshot({ path: `${SHOTS}/local-review-modal.png` })
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 100))
  check('Escape closes the modal', (await page.$('[role="dialog"]')) === null)
  await clickButton('Review payment')
  await page.waitForSelector('[role="dialog"] input[type="checkbox"]')
  await page.click('[role="dialog"] input[type="checkbox"]')

  const bal = async (a) => BigInt(await rpc.send('eth_getBalance', [a, 'latest'])) // uncached
  const before = await Promise.all([R1, R2, R3].map(bal))
  await clickButton('Confirm in MetaMask')
  await waitText(page, 'Gas used', 20000)
  t = await text(page)
  const after = await Promise.all([R1, R2, R3].map(bal))
  const deltas = after.map((a, i) => a - before[i])
  check('Status reaches "Confirmed" with block + gas used', t.includes('Confirmed') && /Block \d+ · Gas used/.test(t))
  check('Local chain: "Local network — no explorer"', t.includes('Local network — no explorer'))
  check('Each recipient received exactly 0.01 ETH on-chain', deltas.every((d) => d === parseEther('0.01')), deltas.map((d) => formatEther(d)).join(', '))
  const newestId = (t.match(/Payment #(\d+)/g) ?? []).map((s) => Number(s.slice(9))).sort((a, b) => b - a)[0]
  const historyText = () => page.$$eval('section', (els) => els.find((e) => e.innerText.startsWith('Payment history'))?.innerText ?? '')
  await page.waitForFunction((id) => [...document.querySelectorAll('section')].some((e) => e.innerText.startsWith('Payment history') && e.innerText.includes(`Payment #${id}`)), { timeout: 10000 }, newestId).catch(() => {})
  check(`History panel auto-refreshed and lists Payment #${newestId}`, (await historyText()).includes(`Payment #${newestId}`))
  check('"This session" list shows the confirmed tx', (await text(page)).includes('This session'))
  await page.screenshot({ path: `${SHOTS}/local-after-payment.png`, fullPage: true })

  // Rejection in "MetaMask"
  await clickButton('Custom amounts')
  await (await addrInputs())[0].type(R1)
  await (await amountInputs())[0].type('0.001')
  await clickButton('Review payment')
  await page.waitForSelector('[role="dialog"] input[type="checkbox"]')
  await page.click('[role="dialog"] input[type="checkbox"]')
  await page.evaluate(() => { window.__rejectNext = true })
  await clickButton('Confirm in MetaMask')
  await waitText(page, 'You rejected the transaction in MetaMask. No ETH was sent.')
  check('User rejection shows the exact message', true)

  // Contract revert caught BEFORE MetaMask opens (recipient rejects ETH -> TransferFailed)
  await setValue((await addrInputs())[0], REJECTING)
  await clickButton('Review payment')
  await page.waitForSelector('[role="dialog"] input[type="checkbox"]')
  await page.click('[role="dialog"] input[type="checkbox"]')
  const nonceBefore = await rpc.getTransactionCount(SENDER)
  await clickButton('Confirm in MetaMask')
  await waitText(page, 'Blocked before sending')
  t = await text(page)
  check('Preflight decodes TransferFailed into plain English', t.includes('refused the ETH') && t.includes('MetaMask was not opened'))
  check('No transaction was sent for the blocked payment', (await rpc.getTransactionCount(SENDER)) === nonceBefore)

  // My payments filter
  await clickButton('My payments')
  await new Promise((r) => setTimeout(r, 500))
  const mine = await historyText()
  // Compare with the chain: which payment IDs were really sent by SENDER?
  const abi = JSON.parse(readFileSync(path.join(ROOT, 'frontend/src/abi/SmartSplit.json'), 'utf8'))
  const events = await new Contract(cfg, abi, rpc).queryFilter('PaymentSplit', 0, 'latest')
  const mineIds = events.filter((e) => e.args.sender === SENDER).map((e) => Number(e.args.paymentId)).sort((a, b) => a - b)
  const shownIds = [...mine.matchAll(/Payment #(\d+)/g)].map((m) => Number(m[1])).sort((a, b) => a - b)
  check('"My payments" shows exactly this sender\'s payments', JSON.stringify(shownIds) === JSON.stringify(mineIds) && mineIds.includes(newestId), `shown ${shownIds} / on-chain ${mineIds}`)

  // Mobile layout
  await page.setViewport({ width: 390, height: 844 })
  await page.screenshot({ path: `${SHOTS}/local-mobile.png`, fullPage: true })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  check('Mobile (390px): no horizontal overflow', !overflow)

  check('No uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exitCode = failed.length ? 1 : 0
