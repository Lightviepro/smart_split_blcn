/**
 * Shared helpers used by deploy.ts and export-abi.ts to "register" a deployed SmartSplit
 * contract with the frontend:
 *   1. copy the ABI to   frontend/src/abi/SmartSplit.json
 *   2. upsert { address, deployBlock } for a chainId in frontend/src/config/contracts.ts
 *
 * Plain Node (no Hardhat runtime needed), so it also works after a Remix deployment.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const HARDHAT_ROOT = path.resolve(here, "..", "..");
export const FRONTEND_ROOT = path.resolve(HARDHAT_ROOT, "..", "frontend");

const ARTIFACT_PATH = path.join(HARDHAT_ROOT, "artifacts/contracts/SmartSplit.sol/SmartSplit.json");
const ABI_OUT = path.join(FRONTEND_ROOT, "src/abi/SmartSplit.json");
const CONFIG_OUT = path.join(FRONTEND_ROOT, "src/config/contracts.ts");

export interface Registration {
  chainId: number;
  address: string;
  deployBlock: number;
}

/** Copy the compiled ABI (only the ABI — not bytecode) into the frontend. */
export function exportAbi(): string {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error(`Artifact not found at ${ARTIFACT_PATH}. Run "npm run compile" first.`);
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as { abi: unknown };
  mkdirSync(path.dirname(ABI_OUT), { recursive: true });
  writeFileSync(ABI_OUT, JSON.stringify(artifact.abi, null, 2) + "\n");
  return ABI_OUT;
}

const ENTRY_RE = /(\d+):\s*\{\s*address:\s*"(0x[0-9a-fA-F]{40})",\s*deployBlock:\s*(\d+),?\s*\}/g;

/** Read existing registrations from contracts.ts (so other chains are preserved). */
export function readRegistrations(): Registration[] {
  if (!existsSync(CONFIG_OUT)) return [];
  const source = readFileSync(CONFIG_OUT, "utf8");
  return [...source.matchAll(ENTRY_RE)].map((m) => ({
    chainId: Number(m[1]),
    address: m[2],
    deployBlock: Number(m[3]),
  }));
}

/** Add or replace the registration for one chain and rewrite contracts.ts. */
export function registerContract(reg: Registration): string {
  const all = readRegistrations().filter((r) => r.chainId !== reg.chainId);
  all.push(reg);
  all.sort((a, b) => a.chainId - b.chainId);

  const entries = all
    .map((r) => `  ${r.chainId}: { address: "${r.address}", deployBlock: ${r.deployBlock} },`)
    .join("\n");

  const source = `// Where SmartSplit is deployed on each chain.
//
// Updated automatically by \`npm run deploy:local\`, \`npm run deploy:sepolia\` and
// \`npm run export-abi -- --address <addr> --block <n> --chain <id>\` (in contracts-hardhat/).
// You can also edit it by hand — keep the one-line-per-chain format below.
//
// deployBlock = the block the contract was deployed in. The history panel starts
// searching for PaymentSplit events from this block (searching from block 0 would be slow).

export interface ContractDeployment {
  address: string;
  deployBlock: number;
}

export const CONTRACTS: Record<number, ContractDeployment> = {
${entries}
};
`;
  mkdirSync(path.dirname(CONFIG_OUT), { recursive: true });
  writeFileSync(CONFIG_OUT, source);
  return CONFIG_OUT;
}
