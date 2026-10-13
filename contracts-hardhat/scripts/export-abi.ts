/**
 * Copy the SmartSplit ABI into the frontend and (optionally) register a deployed address.
 *
 * Typical use — after deploying from Remix:
 *   npm run export-abi -- --address 0xYourContract --block 1234567 --chain 11155111
 *
 * Without arguments it only refreshes frontend/src/abi/SmartSplit.json.
 */
import { parseArgs } from "node:util";
import { exportAbi, readRegistrations, registerContract } from "./lib/frontend-sync.ts";

const { values } = parseArgs({
  options: {
    address: { type: "string" },
    block: { type: "string" },
    chain: { type: "string" },
  },
});

const abiFile = exportAbi();
console.log(`ABI exported -> ${abiFile}`);

const given = [values.address, values.block, values.chain].filter((v) => v !== undefined);
if (given.length === 0) {
  console.log("No --address/--block/--chain given; contract registrations unchanged:");
  console.table(readRegistrations());
  process.exit(0);
}
if (given.length !== 3) {
  console.error("Please pass all three: --address 0x... --block <number> --chain <chainId>");
  process.exit(1);
}

const address = values.address!;
const deployBlock = Number(values.block);
const chainId = Number(values.chain);

if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error(`Invalid address: ${address}`);
  process.exit(1);
}
if (!Number.isInteger(deployBlock) || deployBlock < 0) {
  console.error(`Invalid block number: ${values.block}`);
  process.exit(1);
}
if (chainId !== 11155111 && chainId !== 31337) {
  console.error(`Unsupported chain ${values.chain}. Use 11155111 (Sepolia) or 31337 (Hardhat local).`);
  process.exit(1);
}

const configFile = registerContract({ chainId, address, deployBlock });
console.log(`Registered SmartSplit on chain ${chainId} at ${address} (block ${deployBlock})`);
console.log(`Config updated -> ${configFile}`);
console.log("Rebuild or restart the frontend dev server to pick up the change.");
