// Where SmartSplit is deployed on each chain.
//
// Updated automatically by `npm run deploy:local`, `npm run deploy:sepolia` and
// `npm run export-abi -- --address <addr> --block <n> --chain <id>` (in contracts-hardhat/).
// You can also edit it by hand — keep the one-line-per-chain format below.
//
// deployBlock = the block the contract was deployed in. The history panel starts
// searching for PaymentSplit events from this block (searching from block 0 would be slow).

export interface ContractDeployment {
  address: string;
  deployBlock: number;
}

export const CONTRACTS: Record<number, ContractDeployment> = {
  31337: { address: "0x5FbDB2315678afecb367f032d93F642f64180aa3", deployBlock: 1 },
  11155111: { address: "0x3Ff9C193b1Bd228C76Cd4B1ffE36f3D2F97845fC", deployBlock: 11904281 },
};
