import { AlertTriangle } from 'lucide-react'
import { formatEth, formatEthExact } from '../lib/format'
import { Card } from './ui'

interface Props {
  rowCount: number
  /** Sum of every amount that is currently valid (shown even while other rows have errors). */
  draftTotal: bigint
  balance: bigint | null
  estimatedGasCost: bigint | null
}

export function PaymentSummary({ rowCount, draftTotal, balance, estimatedGasCost }: Props) {
  const needed = draftTotal + (estimatedGasCost ?? 0n)
  const insufficient = balance !== null && draftTotal > 0n && needed > balance

  return (
    <Card title="Summary">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Recipients</dt>
          <dd className="font-medium text-slate-900">{rowCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Total to send</dt>
          <dd className="font-semibold text-slate-900">{formatEthExact(draftTotal)} ETH</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Estimated max gas fee</dt>
          <dd className="text-slate-700">{estimatedGasCost === null ? '—' : `≈ ${formatEth(estimatedGasCost)} ETH`}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2">
          <dt className="text-slate-500">Your balance</dt>
          <dd className="text-slate-700">{balance === null ? '—' : `${formatEth(balance)} ETH`}</dd>
        </div>
      </dl>
      {insufficient && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          The total plus estimated gas is more than your balance. The transaction will probably fail.
        </p>
      )}
    </Card>
  )
}
