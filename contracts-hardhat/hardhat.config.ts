import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { existsSync } from "node:fs";
import path from "node:path";
import { configVariable, defineConfig } from "hardhat/config";

// Optional: load contracts-hardhat/.env (git-ignored) into process.env using Node's built-in
// loader. Values stored in the encrypted Hardhat keystore (`npx hardhat keystore set ...`)
// take priority and are the recommended option — see .env.example.
const envFile = path.join(import.meta.dirname, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Same compiler version + optimizer settings as Remix (see remix/REMIX_GUIDE.md),
// so both tools produce identical bytecode for SmartSplit.sol.
const SOLIDITY_SETTINGS = {
  version: "0.8.28",
  settings: {
    optimizer: { enabled: true, runs: 200 },
  },
};

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: SOLIDITY_SETTINGS,
      production: SOLIDITY_SETTINGS,
    },
  },
  networks: {
    // In-process simulated chain used by `npm test`.
    // (Hardhat 3 calls this network "default"; Hardhat 2 called it "hardhat".)
    default: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 31337,
    },
    // A long-running `npm run node` instance (MetaMask + frontend connect here in dev).
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    // Public testnet for the live demo. Values come from the encrypted Hardhat
    // keystore or environment variables — never hardcoded. See .env.example.
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
  verify: {
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
  },
});
