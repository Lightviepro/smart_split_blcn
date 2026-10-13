import { describe, expect, it } from 'vitest'
import { fetchInChunks, isRangeTooLargeError } from './chunks'

describe('fetchInChunks', () => {
  it('splits a range into fixed chunks covering every block exactly once', async () => {
    const calls: [number, number][] = []
    const out = await fetchInChunks(100, 1234, async (from, to) => {
      calls.push([from, to])
      return [from]
    }, { chunkSize: 500 })
    expect(calls).toEqual([[100, 599], [600, 1099], [1100, 1234]])
    expect(out).toEqual([100, 600, 1100])
  })

  it('returns [] for an empty range', async () => {
    expect(await fetchInChunks(10, 9, async () => [1], { chunkSize: 5 })).toEqual([])
  })

  it('halves the chunk size when the provider says the range is too large', async () => {
    const calls: [number, number][] = []
    await fetchInChunks(0, 9999, async (from, to) => {
      calls.push([from, to])
      if (to - from + 1 > 1000) throw { code: -32005, message: 'query returned more than 10000 results' }
      return []
    }, { chunkSize: 5000 })
    // 5000 fail, 2500 fail, 1250 fail, then 625-block chunks succeed
    expect(calls.slice(0, 4)).toEqual([[0, 4999], [0, 2499], [0, 1249], [0, 624]])
    const covered = calls.filter(([f, t]) => t - f + 1 <= 1000)
    expect(covered[0][0]).toBe(0)
    expect(covered[covered.length - 1][1]).toBe(9999)
  })

  it('rethrows errors that are not range errors', async () => {
    await expect(fetchInChunks(0, 10, async () => { throw new Error('network down') }, { chunkSize: 5 })).rejects.toThrow('network down')
  })

  it('reports progress', async () => {
    const progress: number[] = []
    await fetchInChunks(1, 10, async () => [], { chunkSize: 5, onProgress: (p) => progress.push(p) })
    expect(progress).toEqual([0.5, 1])
  })
})

describe('isRangeTooLargeError', () => {
  it('recognises common provider messages', () => {
    expect(isRangeTooLargeError(new Error('eth_getLogs block range too large'))).toBe(true)
    expect(isRangeTooLargeError({ error: { message: 'query exceeds max block range 1000' } })).toBe(true)
    expect(isRangeTooLargeError({ info: { error: { code: -32005, message: 'limit exceeded' } } })).toBe(true)
    expect(isRangeTooLargeError({ message: 'eth_getLogs is limited to a 10,000 range' })).toBe(true)
    expect(isRangeTooLargeError(new Error('network down'))).toBe(false)
  })
})
