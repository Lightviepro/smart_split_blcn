import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TxState } from '../hooks/useSmartSplit'
import { txUrl } from '../lib/format'
import { buttonSoft, ExternalLink, Panel } from './ui'

type StepState = 'upcoming' | 'current' | 'done' | 'failed'
const STEPS = ['Check', 'Sign', 'Pending', 'Confirmed'] as const

function stepStates(tx: TxState): StepState[] {
  const s = (done: number, current: StepState | null = null): StepState[] =>
    STEPS.map((_, i) => (i < done ? 'done' : i === done && current ? current : 'upcoming'))
  switch (tx.status) {
    case 'idle': return s(0)
    case 'checking': return s(0, 'current')
    case 'awaiting-signature': return s(1, 'current')
    case 'pending': return s(2, 'current')
    case 'confirmed': return s(4)
    case 'rejected': return s(1, 'failed')
    case 'failed': return tx.beforeSending ? s(0, 'failed') : tx.hash ? s(2, 'failed') : s(1, 'failed')
  }
}

function Stepper({ states }: { states: StepState[] }) {
  return (
    <ol className="flex items-start" aria-label="Payment progress">
      {STEPS.map((label, i) => {
        const st = states[i]
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span aria-hidden className={`absolute top-3.5 right-[calc(50%+1.5rem)] h-1 w-[calc(100%-3rem)] rounded-full ${states[i - 1] === 'done' ? 'bg-accent/70' : 'well-sm'}`} />
            )}
            <span
              className={`relative grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-colors duration-150 ${
                st === 'done'
                  ? 'bg-accent text-white shadow-[0_6px_14px_-6px_rgb(106_69_217/0.7)]'
                  : st === 'failed'
                    ? 'bg-danger text-white shadow-[0_6px_14px_-6px_rgb(176_42_55/0.6)]'
                    : st === 'current'
                      ? 'float-sm text-accent ring-2 ring-accent/60'
                      : 'well-sm text-faint'
              }`}
            >
              {st === 'done' ? <Check aria-hidden className="h-4 w-4" /> : st === 'failed' ? <X aria-hidden className="h-4 w-4" /> : (
                <span className={st === 'current' ? 'h-2 w-2 animate-pulse rounded-full bg-accent' : 'font-mono'}>{st === 'current' ? '' : i + 1}</span>
              )}
            </span>
            <span className={`mt-2 text-[11px] font-bold uppercase tracking-wider ${st === 'upcoming' ? 'text-faint' : st === 'failed' ? 'text-danger' : 'text-ink'}`}>
              {label}
              <span className="sr-only"> — {st}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function TxHash({ chainId, hash }: { chainId: number; hash: string }) {
  const url = txUrl(chainId, hash)
  return (
    <div className="well mt-3 rounded-2xl px-4 py-3 text-xs">
      <div className="font-bold uppercase tracking-wider text-muted">Transaction hash</div>
      <div className="mt-1 break-all font-mono text-[12px] text-ink">{hash}</div>
      <div className="mt-2">
        {url ? <ExternalLink href={url}>View on Etherscan</ExternalLink> : <span className="text-muted">Local network — no explorer</span>}
      </div>
    </div>
  )
}

function Message({ title, tone = 'ink', children }: { title: string; tone?: 'ink' | 'accent' | 'success' | 'danger' | 'warn'; children?: ReactNode }) {
  const color = { ink: 'text-ink', accent: 'text-accent', success: 'text-success', danger: 'text-danger', warn: 'text-warn' }[tone]
  return (
    <div className="mt-6 [overflow-wrap:anywhere]">
      <p className={`font-bold ${color}`}>{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function TxStatusPanel({ tx, chainId, onReset }: { tx: TxState; chainId: number; onReset: () => void }) {
  const done = tx.status === 'confirmed' || tx.status === 'failed' || tx.status === 'rejected'
  return (
    <Panel
      step={3}
      title="Track the payment"
      labelledBy="status-title"
      actions={done && <button type="button" className={buttonSoft} onClick={onReset}>Clear</button>}
    >
      <Stepper states={stepStates(tx)} />
      <div aria-live="polite">
        {tx.status === 'idle' && <Message title="Idle">Fill in the form and press “Review payment”.</Message>}
        {tx.status === 'checking' && (
          <Message title="Checking the payment…">Simulating the transaction to catch errors before MetaMask opens.</Message>
        )}
        {tx.status === 'awaiting-signature' && (
          <Message title="Waiting for your signature" tone="accent">Confirm the transaction in the MetaMask window.</Message>
        )}
        {tx.status === 'pending' && (
          <Message title="Pending — waiting for a block" tone="warn">
            Sent to the network. Not confirmed yet.
            <TxHash chainId={chainId} hash={tx.hash} />
          </Message>
        )}
        {tx.status === 'confirmed' && (
          <Message title="Confirmed" tone="success">
            {tx.paymentId !== null && <>Payment #{tx.paymentId.toString()} · </>}
            Block {tx.blockNumber} · Gas used {tx.gasUsed.toLocaleString()}
            <TxHash chainId={chainId} hash={tx.hash} />
          </Message>
        )}
        {tx.status === 'failed' && (
          <Message title={tx.beforeSending ? 'Blocked before sending' : 'Failed'} tone="danger">
            {tx.message}
            {tx.beforeSending && <p className="mt-1 text-xs">MetaMask was not opened and no ETH was sent.</p>}
            {tx.hash && <TxHash chainId={chainId} hash={tx.hash} />}
          </Message>
        )}
        {tx.status === 'rejected' && <Message title="Rejected" tone="danger">{tx.message}</Message>}
      </div>
    </Panel>
  )
}
