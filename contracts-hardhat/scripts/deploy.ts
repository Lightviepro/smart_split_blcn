import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { network } from "hardhat";
import { exportAbi, HARDHAT_ROOT, registerContract } from "./lib/frontend-sync.ts";

const { ethers, networkName } = await network.getOrCreate();

const [deployer] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();
const balance = await ethers.provider.getBalance(deployer.address);

console.log(`Network:  ${networkName} (chainId ${chainId})`);
console.log(`Deployer: ${deployer.address}`);
console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
console.log("Deploying SmartSplit...");

const smartSplit = await ethers.deployContract("SmartSplit");
const deployTx = smartSplit.deploymentTransaction();
if (deployTx === null) throw new Error("No deployment transaction found");
console.log(`Tx hash:  ${deployTx.hash} (waiting for confirmation...)`);

const receipt = await deployTx.wait(chainId === 31337n ? 1 : 2);
if (receipt === null || receipt.status !== 1) throw new Error("Deployment transaction failed");

const address = await smartSplit.getAddress();
const block = await ethers.provider.getBlock(receipt.blockNumber);

const deployment = {
  network: networkName,
  chainId: Number(chainId),
  address,
  deployer: deployer.address,
  txHash: receipt.hash,
  blockNumber: receipt.blockNumber,
  gasUsed: receipt.gasUsed.toString(),
  timestamp: block ? new Date(block.timestamp * 1000).toISOString() : null,
};

const outDir = path.join(HARDHAT_ROOT, "deployments");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${networkName}.json`);
writeFileSync(outFile, JSON.stringify(deployment, null, 2) + "\n");

console.log(`\nSmartSplit deployed`);
console.log(`  address:     ${address}`);
console.log(`  block:       ${receipt.blockNumber}`);
console.log(`  gas used:    ${receipt.gasUsed}`);
console.log(`  saved:       ${path.relative(process.cwd(), outFile)}`);

const abiFile = exportAbi();
const configFile = registerContract({
  chainId: Number(chainId),
  address,
  deployBlock: receipt.blockNumber,
});
console.log(`  ABI ->       ${path.relative(process.cwd(), abiFile)}`);
console.log(`  config ->    ${path.relative(process.cwd(), configFile)}`);

if (chainId === 11155111n) {
  console.log(`\nEtherscan: https://sepolia.etherscan.io/address/${address}`);
}
