/**
 * End-to-end demo on the local Hardhat node: one transaction splits 0.03 ETH equally among
 * three recipients, and the script prints balances before/after to prove it.
 *
 *   Terminal 1: npm run node
 *   Terminal 2: npm run deploy:local && npm run demo:local
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { network } from "hardhat";
import { HARDHAT_ROOT } from "./lib/frontend-sync.ts";

const { ethers, networkName } = await network.getOrCreate();

const deploymentFile = path.join(HARDHAT_ROOT, "deployments", `${networkName}.json`);
if (!existsSync(deploymentFile)) {
  throw new Error(`No deployment found at ${deploymentFile}. Run "npm run deploy:local" first.`);
}
const { address } = JSON.parse(readFileSync(deploymentFile, "utf8")) as { address: string };
if ((await ethers.provider.getCode(address)) === "0x") {
  throw new Error(
    `No contract code at ${address}. Was the node restarted? Run "npm run deploy:local" again.`,
  );
}
const smartSplit = await ethers.getContractAt("SmartSplit", address);

const [sender, ...others] = await ethers.getSigners();
const recipients = others.slice(0, 3).map((s) => s.address);

// Equal split in wei, using integer (bigint) maths only: the first `remainder` recipients get
// one extra wei, so the amounts always add up to exactly `total`. Same rule as the frontend.
const total = ethers.parseEther("0.03");
const n = BigInt(recipients.length);
const share = total / n;
const remainder = total % n;
const amounts = recipients.map((_, i) => share + (BigInt(i) < remainder ? 1n : 0n));

const fmt = (wei: bigint) => `${ethers.formatEther(wei)} ETH`;
const balancesOf = (addrs: string[]) =>
  Promise.all(addrs.map((a) => ethers.provider.getBalance(a)));

const everyone = [sender.address, ...recipients, address];
const labels = ["sender", "recipient 1", "recipient 2", "recipient 3", "SmartSplit contract"];

console.log(`SmartSplit at ${address} on ${networkName}`);
console.log(`Splitting ${fmt(total)} equally among ${recipients.length} recipients\n`);

const before = await balancesOf(everyone);
const tx = await smartSplit.connect(sender).splitPayment(recipients, amounts, { value: total });
console.log(`tx sent:      ${tx.hash}`);
const receipt = await tx.wait(1);
if (receipt === null || receipt.status !== 1) throw new Error("Transaction failed");
console.log(`confirmed in block ${receipt.blockNumber}, gas used ${receipt.gasUsed}\n`);
const after = await balancesOf(everyone);

const gasCost = receipt.gasUsed * receipt.gasPrice;
console.table(
  everyone.map((addr, i) => ({
    who: labels[i],
    address: addr,
    before: fmt(before[i]),
    after: fmt(after[i]),
    change: fmt(after[i] - before[i]),
  })),
);

// Read the PaymentSplit event back out of the receipt.
for (const log of receipt.logs) {
  const parsed = smartSplit.interface.parseLog(log);
  if (parsed?.name === "PaymentSplit") {
    console.log(`\nPaymentSplit event: paymentId=${parsed.args.paymentId} total=${fmt(parsed.args.total)}`);
  }
}
console.log(`paymentCount now: ${await smartSplit.paymentCount()}`);

// Prove the maths — fail loudly if anything is off.
const checks = [
  ...recipients.map((_, i) => after[i + 1] - before[i + 1] === amounts[i]),
  before[0] - after[0] === total + gasCost, // sender paid exactly total + gas
  after[4] === 0n, // contract kept nothing
];
if (checks.every(Boolean)) {
  console.log("\n✅ Verified: each recipient received exactly their share, the sender paid exactly");
  console.log(`   ${fmt(total)} + ${fmt(gasCost)} gas, and the contract balance is 0.`);
} else {
  console.error("\n❌ Balance check FAILED", checks);
  process.exitCode = 1;
}
