/**
 * Fetch logs over a big block range in chunks.
 *
 * RPC providers (including MetaMask's default ones) refuse log queries over too many blocks.
 * We query `chunkSize` blocks at a time, and when the provider says the range is too large we
 * halve the chunk and retry, down to a single block.
 */

/** Does this error look like an RPC "block range too large / too many results" error? */
export function isRangeTooLargeError(error: unknown): boolean {
  const text = collectErrorText(error).toLowerCase()
  return /block range|range (is )?too (large|wide|big)|too many (blocks|results|logs)|exceed|query returned more than|limited to|max(imum)? block range|-32005|response size/.test(
    text,
  )
}

function collectErrorText(error: unknown, depth = 0): string {
  if (depth > 4 || error === null || error === undefined) return ''
  if (typeof error === 'string') return error
  if (typeof error !== 'object') return String(error)
  const e = error as Record<string, unknown>
  return [e.message, e.shortMessage, e.code, collectErrorText(e.error, depth + 1), collectErrorText(e.info, depth + 1)]
    .filter((v) => v !== undefined)
    .join(' ')
}

export interface ChunkOptions {
  chunkSize: number
  /** Called after each successful chunk with progress (0..1). */
  onProgress?: (fraction: number) => void
}

export async function fetchInChunks<T>(
  fromBlock: number,
  toBlock: number,
  fetchRange: (from: number, to: number) => Promise<T[]>,
  { chunkSize, onProgress }: ChunkOptions,
): Promise<T[]> {
  if (toBlock < fromBlock) return []
  const results: T[] = []
  let size = Math.max(1, Math.floor(chunkSize))
  let start = fromBlock
  const span = toBlock - fromBlock + 1

  while (start <= toBlock) {
    const end = Math.min(start + size - 1, toBlock)
    try {
      results.push(...(await fetchRange(start, end)))
      start = end + 1
      onProgress?.((start - fromBlock) / span)
    } catch (error) {
      if (isRangeTooLargeError(error) && size > 1) {
        size = Math.max(1, Math.floor(size / 2))
        continue
      }
      throw error
    }
  }
  return results
}
