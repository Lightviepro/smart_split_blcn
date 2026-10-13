import { parseEther } from 'ethers'
import { describe, expect, it } from 'vitest'
import { equalSplit, estimateGasUpperBound, sumWei } from './split'

describe('equalSplit', () => {
  it('1 wei / 3 -> [1, 0, 0] (sum preserved; zero shares are rejected by validation)', () => {
    const parts = equalSplit(1n, 3)
    expect(parts).toEqual([1n, 0n, 0n])
    expect(sumWei(parts)).toBe(1n)
  })

  it('0.03 ETH / 3 -> exactly 0.01 ETH each', () => {
    const parts = equalSplit(parseEther('0.03'), 3)
    expect(parts).toEqual([parseEther('0.01'), parseEther('0.01'), parseEther('0.01')])
  })

  it('0.1 ETH / 7 -> first 2 recipients get 1 extra wei, sum is exact', () => {
    const total = parseEther('0.1')
    const parts = equalSplit(total, 7)
    const share = 14285714285714285n
    expect(total % 7n).toBe(5n)
    expect(parts).toEqual([share + 1n, share + 1n, share + 1n, share + 1n, share + 1n, share, share])
    expect(sumWei(parts)).toBe(total)
  })

  it('10 wei / 3 -> [4, 3, 3]', () => {
    expect(equalSplit(10n, 3)).toEqual([4n, 3n, 3n])
  })

  it('always sums to the total and parts differ by at most 1 wei', () => {
    for (const total of [1n, 7n, 999n, parseEther('1'), parseEther('0.123456789012345678')]) {
      for (let n = 1; n <= 20; n++) {
        const parts = equalSplit(total, n)
        expect(parts).toHaveLength(n)
        expect(sumWei(parts)).toBe(total)
        const max = parts.reduce((a, b) => (a > b ? a : b))
        const min = parts.reduce((a, b) => (a < b ? a : b))
        expect(max - min <= 1n).toBe(true)
      }
    }
  })

  it('rejects invalid n and negative totals', () => {
    expect(() => equalSplit(10n, 0)).toThrow(RangeError)
    expect(() => equalSplit(10n, 1.5)).toThrow(RangeError)
    expect(() => equalSplit(-1n, 2)).toThrow(RangeError)
  })
})

describe('sumWei / estimateGasUpperBound', () => {
  it('sums bigints', () => {
    expect(sumWei([])).toBe(0n)
    expect(sumWei([1n, 2n, 3n])).toBe(6n)
  })

  it('local upper bound covers the measured Hardhat worst cases', () => {
    expect(estimateGasUpperBound(1, 31337)).toBeGreaterThanOrEqual(87_027n)
    expect(estimateGasUpperBound(20, 31337)).toBeGreaterThanOrEqual(821_925n)
  })

  it('Sepolia upper bound covers the estimated Sepolia worst cases', () => {
    expect(estimateGasUpperBound(1, 11155111)).toBeGreaterThanOrEqual(448_537n)
    expect(estimateGasUpperBound(3, 11155111)).toBeGreaterThanOrEqual(852_184n)
    expect(estimateGasUpperBound(20, 11155111)).toBeGreaterThanOrEqual(4_268_917n)
    expect(estimateGasUpperBound(1)).toBe(estimateGasUpperBound(1, 11155111))
  })
})
