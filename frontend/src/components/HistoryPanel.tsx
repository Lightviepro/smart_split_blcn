import { ChevronDown, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import type { HistoryFilter, PaymentRecord } from '../hooks/usePaymentHistory'
import type { SessionTx } from '../hooks/useSmartSplit'
import { formatEthExact, formatTimestamp, shortenAddress, txUrl } from '../lib/format'
import { Chip, eyebrow, ExternalLink, iconButton, Panel, Segmented } from './ui'

interface Props {
  chainId: number
  account: string | null
  filter: HistoryFilter
  onFilterChange: (filter: HistoryFilter) => void
  records: PaymentRecord[]
  loading: boolean
  progress: number
  error: string | null
  onRefresh: () => void
  sessionTxs: SessionTx[]
}

const FILTERS = [
  { value: 'mine', label: 'My payments' },
  { value: 'all', label: 'All payments' },
] as const satisfies readonly { value: HistoryFilter; label: string }[]

function HashLink({ chainId, hash }: { chainId: number; hash: string }) {
  const url = txUrl(chainId, hash)
  const short = <span className="font-mono">{shortenAddress(hash, 6)}</span>
  return url ? <ExternalLink href={url}>{short}</ExternalLink> : <span title={hash}>{short}</span>
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="well rounded-2xl px-4 py-8 text-center text-sm text-muted">{children}</p>
}

function PaymentItem({ record, chainId, account }: { record: PaymentRecord; chainId: number; account: string | null }) {
  const isMine = account !== null && record.sender.toLowerCase() === account.toLowerCase()
  const n = record.recipients.length
  return (
    <li className="float-sm rounded-2xl">
      <details className="group">
        <summary className="focus-ring flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-3">
            <ChevronDown aria-hidden className="h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-180" />
            <span className="font-bold text-ink">Payment #{record.paymentId.toString()}</span>
            <Chip tone="success">Confirmed</Chip>
            {isMine && <Chip dot={false}>you</Chip>}
          </div>
          <div className="text-sm text-muted">
            <span className="font-bold text-ink">{formatEthExact(record.total)} ETH</span> to {n} recipient{n === 1 ? '' : 's'}
          </div>
        </summary>
        <div className="space-y-4 px-4 pt-1 pb-4">
          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className={eyebrow}>Sender</dt>
              <dd className="mt-1 font-mono text-[12px] text-ink" title={record.sender}>{shortenAddress(record.sender, 6)}</dd>
            </div>
            <div>
              <dt className={eyebrow}>Time</dt>
              <dd className="mt-1 text-ink">{formatTimestamp(record.timestamp)}</dd>
            </div>
            <div>
              <dt className={eyebrow}>Transaction · block {record.blockNumber}</dt>
              <dd className="mt-1">
                <HashLink chainId={chainId} hash={record.txHash} />
              </dd>
            </div>
          </dl>
          <table className="well w-full overflow-hidden rounded-2xl text-left text-xs">
            <caption className="sr-only">Recipients of payment {record.paymentId.toString()}</caption>
            <thead>
              <tr className={eyebrow}>
                <th scope="col" className="px-4 pt-3 pb-1 font-bold">Recipient</th>
                <th scope="col" className="px-4 pt-3 pb-1 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {record.recipients.map((r, i) => (
                <tr key={r}>
                  <td className="break-all px-4 py-1.5 font-mono text-[12px] text-ink">{r}</td>
                  <td className="whitespace-nowrap px-4 py-1.5 text-right font-semibold text-ink">{formatEthExact(record.amounts[i])} ETH</td>
                </tr>
              ))}
              <tr><td colSpan={2} className="pb-2" /></tr>
            </tbody>
          </table>
        </div>
      </details>
    </li>
  )
}

export function HistoryPanel({ chainId, account, filter, onFilterChange, records, loading, progress, error, onRefresh, sessionTxs }: Props) {
  const sessionForChain = sessionTxs.filter((t) => t.chainId === chainId)
  return (
    <Panel
      title="Payment history"
      labelledBy="history-title"
      subtitle="Read directly from the blockchain (PaymentSplit events). Only confirmed payments appear here."
      actions={
        <div className="flex items-center gap-3">
          <Segmented label="Which payments" value={filter} options={FILTERS} onChange={onFilterChange} />
          <button type="button" className={iconButton} onClick={onRefresh} disabled={loading} aria-label="Refresh history">
            <RotateCw aria-hidden className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          Could not load history: {error}
        </p>
      )}

      {loading && records.length === 0 ? (
        <Empty>Loading events… {Math.round(progress * 100)}%</Empty>
      ) : filter === 'mine' && !account ? (
        <Empty>Connect your wallet to see your payments, or choose “All payments”.</Empty>
      ) : records.length === 0 && !error ? (
        <Empty>No payments yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <PaymentItem key={r.txHash + r.paymentId.toString()} record={r} chainId={chainId} account={account} />
          ))}
        </ul>
      )}

      {sessionForChain.length > 0 && (
        <div className="mt-7">
          <h3 className="text-sm font-bold text-ink">This session</h3>
          <p className="mb-3 text-xs text-muted">
            Transactions sent from this browser tab, including pending and failed ones. Kept only in this tab, not on-chain history.
          </p>
          <ul className="well divide-y divide-line rounded-2xl px-4 text-xs">
            {sessionForChain.map((t) => (
              <li key={t.hash} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="flex items-center gap-2 text-ink">
                  <Chip tone={t.status === 'confirmed' ? 'success' : t.status === 'pending' ? 'warn' : 'danger'}>{t.status}</Chip>
                  {formatEthExact(BigInt(t.total))} ETH → {t.recipientCount} recipient{t.recipientCount === 1 ? '' : 's'}
                </span>
                <HashLink chainId={chainId} hash={t.hash} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
