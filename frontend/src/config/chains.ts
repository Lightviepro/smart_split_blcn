import { LOCAL_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../lib/format'
import { CONTRACTS, type ContractDeployment } from './contracts'

/**
 * The local Hardhat chain is offered only in development (`npm run dev`) or when
 * VITE_ENABLE_LOCAL_CHAIN=true. A production build for the demo is Sepolia-only.
 */
export const LOCAL_CHAIN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_CHAIN === 'true'

export const SUPPORTED_CHAIN_IDS: number[] = LOCAL_CHAIN_ENABLED
  ? [SEPOLIA_CHAIN_ID, LOCAL_CHAIN_ID]
  : [SEPOLIA_CHAIN_ID]

/** Blocks per eth_getLogs request when loading history (halved automatically on errors). */
const configuredChunk = Number(import.meta.env.VITE_LOG_CHUNK_SIZE)
export const LOG_CHUNK_SIZE = Number.isInteger(configuredChunk) && configuredChunk > 0 ? configuredChunk : 5000

export function isSupportedChain(chainId: number | null): chainId is number {
  return chainId !== null && SUPPORTED_CHAIN_IDS.includes(chainId)
}

export function getDeployment(chainId: number | null): ContractDeployment | null {
  if (!isSupportedChain(chainId)) return null
  return CONTRACTS[chainId] ?? null
}

/** Parameters for wallet_addEthereumChain. */
export const ADD_CHAIN_PARAMS: Record<number, object> = {
  [SEPOLIA_CHAIN_ID]: {
    chainId: '0xaa36a7',
    chainName: 'Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  [LOCAL_CHAIN_ID]: {
    chainId: '0x7a69',
    chainName: 'Hardhat Local',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['http://127.0.0.1:8545'],
  },
}
