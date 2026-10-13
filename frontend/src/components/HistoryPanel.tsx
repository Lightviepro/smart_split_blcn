import { CheckCircle2, ChevronDown, RefreshCw } from 'lucide-react'
import type { HistoryFilter, PaymentRecord } from '../hooks/usePaymentHistory'
import type { SessionTx } from '../hooks/useSmartSplit'
import { formatEthExact, formatTimestamp, shortenAddress, txUrl } from '../lib/format'
import { Badge, buttonSecondary, Card, ExternalLink } from './ui'

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

function HashLink({ chainId, hash }: { chainId: number; hash: string }) {
  const url = txUrl(chainId, hash)
  const short = <span className="font-mono">{shortenAddress(hash, 6)}</span>
  return url ? <ExternalLink href={url}>{short}</ExternalLink> : <span title={hash}>{short}</span>
}

function PaymentItem({ record, chainId, account }: { record: PaymentRecord; chainId: number; account: string | null }) {
  const isMine = account !== null && record.sender.toLowerCase() === account.toLowerCase()
  return (
    <li className="rounded-lg border border-slate-200">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-lg p-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500">
          <div className="flex items-center gap-2">
            <ChevronDown aria-hidden className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
            <span className="font-semibold text-slate-900">Payment #{record.paymentId.toString()}</span>
            <Badge tone="green">
              <CheckCircle2 aria-hidden className="h-3 w-3" />
              Confirmed
            </Badge>
          </div>
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{formatEthExact(record.total)} ETH</span> to {record.recipients.length} recipient
            {record.recipients.length === 1 ? '' : 's'}
          </div>
        </summary>
        <div className="space-y-3 border-t border-slate-100 p-3 text-sm">
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">Sender</dt>
              <dd className="font-mono text-xs" title={record.sender}>
                {shortenAddress(record.sender, 6)} {isMine && <Badge tone="indigo">you</Badge>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Time</dt>
              <dd className="text-xs">{formatTimestamp(record.timestamp)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Transaction (block {record.blockNumber})</dt>
              <dd className="text-xs">
                <HashLink chainId={chainId} hash={record.txHash} />
              </dd>
            </div>
          </dl>
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Recipients of payment {record.paymentId.toString()}</caption>
            <thead className="text-slate-500">
              <tr>
                <th scope="col" className="py-1">Recipient</th>
                <th scope="col" className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {record.recipients.map((r, i) => (
                <tr key={r}>
                  <td className="break-all py-1 font-mono">{r}</td>
                  <td className="whitespace-nowrap py-1 pl-2 text-right">{formatEthExact(record.amounts[i])} ETH</td>
                </tr>
              ))}
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
    <Card
      title="Payment history"
      actions={
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Which payments" className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
            {(['mine', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => onFilterChange(f)}
                className={`rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                  filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f === 'mine' ? 'My payments' : 'All payments'}
              </button>
            ))}
          </div>
          <button type="button" className={buttonSecondary} onClick={onRefresh} disabled={loading} aria-label="Refresh history">
            <RefreshCw aria-hidden className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        Read directly from the blockchain (PaymentSplit events). Only confirmed payments appear here.
      </p>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Could not load history: {error}
        </p>
      )}

      {loading && records.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Loading events… {Math.round(progress * 100)}%</p>
      ) : filter === 'mine' && !account ? (
        <p className="py-6 text-center text-sm text-slate-500">Connect your wallet to see your payments, or choose “All payments”.</p>
      ) : records.length === 0 && !error ? (
        <p className="py-6 text-center text-sm text-slate-500">No payments yet.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <PaymentItem key={r.txHash + r.paymentId.toString()} record={r} chainId={chainId} account={account} />
          ))}
        </ul>
      )}

      {sessionForChain.length > 0 && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">This session</h3>
          <p className="mb-2 text-xs text-slate-500">
            Transactions sent from this browser tab, including pending and failed ones. Kept only in this tab, not on-chain history.
          </p>
          <ul className="space-y-1 text-xs">
            {sessionForChain.map((t) => (
              <li key={t.hash} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2">
                <span className="flex items-center gap-2">
                  <Badge tone={t.status === 'confirmed' ? 'green' : t.status === 'pending' ? 'amber' : 'red'}>{t.status}</Badge>
                  {formatEthExact(BigInt(t.total))} ETH → {t.recipientCount} recipient{t.recipientCount === 1 ? '' : 's'}
                </span>
                <HashLink chainId={chainId} hash={t.hash} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
