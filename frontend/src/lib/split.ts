/**
 * Equal-split maths. Everything is bigint wei — no floating point anywhere.
 */

/**
 * Split `total` wei among `n` recipients so the parts add up to EXACTLY `total`.
 *
 * share     = total / n   (integer division, rounds down)
 * remainder = total % n   (0 .. n-1 wei left over)
 * The first `remainder` recipients get one extra wei each.
 *
 * Example: 1 wei / 3  -> [1, 0, 0]   (callers must reject zero shares)
 *          10 wei / 3 -> [4, 3, 3]
 */
export function equalSplit(total: bigint, n: number): bigint[] {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError('n must be a positive integer')
  if (total < 0n) throw new RangeError('total must not be negative')
  const count = BigInt(n)
  const share = total / count
  const remainder = total % count
  return Array.from({ length: n }, (_, i) => share + (BigInt(i) < remainder ? 1n : 0n))
}

/** Sum of a list of wei amounts. */
export function sumWei(values: readonly bigint[]): bigint {
  return values.reduce((acc, v) => acc + v, 0n)
}

/**
 * Generous upper-bound gas estimate for a split to `n` recipients, used only for the
 * "you may not have enough ETH for gas" warning before MetaMask gives the real number.
 *
 * Gas rules differ per network (see docs/TEST_RESULTS.md):
 * - Hardhat local (cancun rules), measured: ~87k for 1 new recipient, ~822k for 20.
 * - Sepolia (network upgrade of 6 Oct 2026 prices new storage/accounts much higher),
 *   estimated with eth_estimateGas: ~449k for 1 new recipient, ~852k for 3, ~4.27M for 20.
 */
export function estimateGasUpperBound(n: number, chainId: number | null = null): bigint {
  const count = BigInt(Math.max(n, 0))
  if (chainId === 31337) return 50_000n + 40_000n * count
  return 300_000n + 230_000n * count // Sepolia and anything unknown: the expensive case
}
