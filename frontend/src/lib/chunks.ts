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
