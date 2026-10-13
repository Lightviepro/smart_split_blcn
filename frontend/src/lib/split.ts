export function equalSplit(total: bigint, n: number): bigint[] {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError('n must be a positive integer')
  if (total < 0n) throw new RangeError('total must not be negative')
  const count = BigInt(n)
  const share = total / count
  const remainder = total % count
  return Array.from({ length: n }, (_, i) => share + (BigInt(i) < remainder ? 1n : 0n))
}

export function sumWei(values: readonly bigint[]): bigint {
  return values.reduce((acc, v) => acc + v, 0n)
}

export function estimateGasUpperBound(n: number, chainId: number | null = null): bigint {
  const count = BigInt(Math.max(n, 0))
  if (chainId === 31337) return 50_000n + 40_000n * count
  return 300_000n + 230_000n * count
}
