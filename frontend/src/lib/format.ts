import { formatEther } from 'ethers'

export const SEPOLIA_CHAIN_ID = 11155111
export const LOCAL_CHAIN_ID = 31337

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= 2 + chars * 2) return address
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`
}

export function formatEth(wei: bigint, maxDecimals = 6): string {
  const exact = formatEther(wei)
  const [whole, fraction = ''] = exact.split('.')
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, '')
  if (trimmed === '' && wei > 0n && whole === '0') return `<0.${'0'.repeat(maxDecimals - 1)}1`
  return trimmed === '' ? whole : `${whole}.${trimmed}`
}

export function formatEthExact(wei: bigint): string {
  return formatEther(wei).replace(/\.0$/, '')
}

export function chainName(chainId: number | null | undefined): string {
  if (chainId === SEPOLIA_CHAIN_ID) return 'Sepolia'
  if (chainId === LOCAL_CHAIN_ID) return 'Hardhat Local'
  if (chainId === null || chainId === undefined) return 'Unknown'
  return `Chain ${chainId}`
}

export function txUrl(chainId: number | null | undefined, hash: string): string | null {
  return chainId === SEPOLIA_CHAIN_ID ? `https://sepolia.etherscan.io/tx/${hash}` : null
}

export function addressUrl(chainId: number | null | undefined, address: string): string | null {
  return chainId === SEPOLIA_CHAIN_ID ? `https://sepolia.etherscan.io/address/${address}` : null
}

export function formatTimestamp(seconds: bigint | number): string {
  return new Date(Number(seconds) * 1000).toLocaleString()
}
