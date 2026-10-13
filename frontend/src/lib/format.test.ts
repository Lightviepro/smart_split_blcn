import { parseEther } from 'ethers'
import { describe, expect, it } from 'vitest'
import { addressUrl, chainName, formatEth, formatEthExact, shortenAddress, txUrl } from './format'

const ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

describe('format', () => {
  it('shortenAddress', () => {
    expect(shortenAddress(ADDR)).toBe('0x7099…79C8')
    expect(shortenAddress(ADDR, 6)).toBe('0x709979…dc79C8')
    expect(shortenAddress('0x12')).toBe('0x12')
  })

  it('formatEth trims and rounds down', () => {
    expect(formatEth(parseEther('1'))).toBe('1')
    expect(formatEth(parseEther('0.01'))).toBe('0.01')
    expect(formatEth(parseEther('0.0123456789'))).toBe('0.012345')
    expect(formatEth(0n)).toBe('0')
    expect(formatEth(1n)).toBe('<0.000001')
    expect(formatEth(parseEther('12.5'), 2)).toBe('12.5')
  })

  it('formatEthExact keeps full precision', () => {
    expect(formatEthExact(1n)).toBe('0.000000000000000001')
    expect(formatEthExact(parseEther('2'))).toBe('2')
    expect(formatEthExact(14285714285714286n)).toBe('0.014285714285714286')
  })

  it('chainName', () => {
    expect(chainName(11155111)).toBe('Sepolia')
    expect(chainName(31337)).toBe('Hardhat Local')
    expect(chainName(1)).toBe('Chain 1')
    expect(chainName(null)).toBe('Unknown')
  })

  it('explorer links only exist on Sepolia', () => {
    expect(txUrl(11155111, '0xabc')).toBe('https://sepolia.etherscan.io/tx/0xabc')
    expect(txUrl(31337, '0xabc')).toBeNull()
    expect(addressUrl(11155111, ADDR)).toBe(`https://sepolia.etherscan.io/address/${ADDR}`)
    expect(addressUrl(31337, ADDR)).toBeNull()
  })
})
