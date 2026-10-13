import { EventLog, type BrowserProvider, type Contract } from 'ethers'
import { useCallback, useState } from 'react'
import { LOG_CHUNK_SIZE } from '../config/chains'
import { fetchInChunks } from '../lib/chunks'
import { useAsyncData } from './useAsyncData'

export interface PaymentRecord {
  paymentId: bigint
  sender: string
  recipients: string[]
  amounts: bigint[]
  total: bigint
  timestamp: bigint
  txHash: string
  blockNumber: number
}

export type HistoryFilter = 'mine' | 'all'

/**
 * Payment history read straight from the blockchain: every PaymentSplit event emitted by the
 * contract since its deployment block. There is no database — the event log IS the history.
 */
export function usePaymentHistory(
  provider: BrowserProvider | null,
  contract: Contract | null,
  deployBlock: number | null,
  account: string | null,
  filter: HistoryFilter,
) {
  const [progress, setProgress] = useState<{ key: string; value: number } | null>(null)

  const enabled = provider !== null && contract !== null && deployBlock !== null && (filter === 'all' || account !== null)
  const key = enabled ? `${String(contract.target)}:${filter}:${filter === 'mine' ? account : ''}` : null

  const load = useCallback(async (): Promise<PaymentRecord[]> => {
    // Ask the node directly (provider.send is uncached). ethers briefly caches getBlockNumber(),
    // which could miss the block of a payment that was confirmed a moment ago.
    const latest = Number(await provider!.send('eth_blockNumber', []))
    // `sender` is an indexed event parameter, so the node filters by it for us.
    const eventFilter =
      filter === 'mine' ? contract!.filters.PaymentSplit(null, account) : contract!.filters.PaymentSplit()

    const logs = await fetchInChunks(
      deployBlock!,
      latest,
      (from, to) => contract!.queryFilter(eventFilter, from, to),
      { chunkSize: LOG_CHUNK_SIZE, onProgress: (value) => setProgress({ key: key!, value }) },
    )

    return logs
      .filter((log): log is EventLog => log instanceof EventLog)
      .map((log) => ({
        paymentId: log.args.paymentId as bigint,
        sender: log.args.sender as string,
        recipients: [...(log.args.recipients as string[])],
        amounts: [...(log.args.amounts as bigint[])],
        total: log.args.total as bigint,
        timestamp: log.args.timestamp as bigint,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      }))
      .reverse() // newest first
  }, [provider, contract, deployBlock, account, filter, key])

  const data = useAsyncData(key, load)
  const error = data.error
    ? ((data.error as { shortMessage?: string }).shortMessage ?? (data.error as Error).message ?? 'Failed to load history')
    : null

  return {
    records: data.value ?? [],
    loading: data.loading,
    progress: progress !== null && progress.key === key ? progress.value : 0,
    error,
    refresh: data.reload,
  }
}
