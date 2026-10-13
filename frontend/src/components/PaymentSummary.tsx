import type { ReactNode } from 'react'
import { formatEth, formatEthExact } from '../lib/format'
import { eyebrow, Panel } from './ui'

interface Props {
  rowCount: number
  /** Sum of every amount that is currently valid (shown even while other rows have errors). */
  draftTotal: bigint
  balance: bigint | null
  estimatedGasCost: bigint | null
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink">{children}</dd>
    </div>
  )
}

export function PaymentSummary({ rowCount, draftTotal, balance, estimatedGasCost }: Props) {
  const needed = draftTotal + (estimatedGasCost ?? 0n)
  const insufficient = balance !== null && draftTotal > 0n && needed > balance

  return (
    <Panel title="Summary" labelledBy="summary-title">
      <div className="well rounded-2xl px-5 py-4">
        <p className={eyebrow}>Total to send</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-ink">
          {formatEthExact(draftTotal)} <span className="text-base font-bold text-muted">ETH</span>
        </p>
        <p className="mt-0.5 text-xs text-muted">
          to {rowCount} recipient{rowCount === 1 ? '' : 's'} in one transaction
        </p>
      </div>
      <dl className="mt-3 px-1">
        <Line label="Estimated max gas fee">{estimatedGasCost === null ? '—' : `≈ ${formatEth(estimatedGasCost)} ETH`}</Line>
        <Line label="Your balance">{balance === null ? '—' : `${formatEth(balance)} ETH`}</Line>
      </dl>
      {insufficient && (
        <p role="alert" className="mt-2 rounded-2xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          The total plus estimated gas is more than your balance. The transaction will probably fail.
        </p>
      )}
    </Panel>
  )
}
