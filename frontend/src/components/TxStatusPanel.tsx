import { CheckCircle2, CircleDashed, Loader2, PenLine, ShieldX, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TxState } from '../hooks/useSmartSplit'
import { txUrl } from '../lib/format'
import { buttonSecondary, Card, ExternalLink } from './ui'

function TxHash({ chainId, hash }: { chainId: number; hash: string }) {
  const url = txUrl(chainId, hash)
  return (
    <div className="mt-2 text-xs">
      <div className="text-slate-500">Transaction hash</div>
      <div className="break-all font-mono text-slate-800">{hash}</div>
      <div className="mt-1">
        {url ? <ExternalLink href={url}>View on Etherscan</ExternalLink> : <span className="text-slate-500">Local network — no explorer</span>}
      </div>
    </div>
  )
}

function Row({ icon, title, tone, children }: { icon: ReactNode; title: string; tone: string; children?: ReactNode }) {
  return (
    <div className={`rounded-lg p-3 ${tone}`}>
      <div className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      {children && <div className="mt-1 text-sm [overflow-wrap:anywhere]">{children}</div>}
    </div>
  )
}

export function TxStatusPanel({ tx, chainId, onReset }: { tx: TxState; chainId: number; onReset: () => void }) {
  const done = tx.status === 'confirmed' || tx.status === 'failed' || tx.status === 'rejected'
  return (
    <Card title="Transaction status" actions={done && <button type="button" className={buttonSecondary} onClick={onReset}>Clear</button>}>
      <div aria-live="polite">
        {tx.status === 'idle' && (
          <Row icon={<CircleDashed aria-hidden className="h-5 w-5" />} title="Idle" tone="bg-slate-50 text-slate-600">
            Fill in the form and press “Review payment”.
          </Row>
        )}
        {tx.status === 'checking' && (
          <Row icon={<Loader2 aria-hidden className="h-5 w-5 animate-spin" />} title="Checking the payment…" tone="bg-slate-50 text-slate-700">
            Simulating the transaction to catch errors before MetaMask opens.
          </Row>
        )}
        {tx.status === 'awaiting-signature' && (
          <Row icon={<PenLine aria-hidden className="h-5 w-5" />} title="Waiting for your signature" tone="bg-indigo-50 text-indigo-900">
            Confirm the transaction in the MetaMask window.
          </Row>
        )}
        {tx.status === 'pending' && (
          <Row icon={<Loader2 aria-hidden className="h-5 w-5 animate-spin" />} title="Pending — waiting for a block" tone="bg-amber-50 text-amber-900">
            Sent to the network. Not confirmed yet.
            <TxHash chainId={chainId} hash={tx.hash} />
          </Row>
        )}
        {tx.status === 'confirmed' && (
          <Row icon={<CheckCircle2 aria-hidden className="h-5 w-5" />} title="Confirmed" tone="bg-emerald-50 text-emerald-900">
            {tx.paymentId !== null && <>Payment #{tx.paymentId.toString()} · </>}
            Block {tx.blockNumber} · Gas used {tx.gasUsed.toLocaleString()}
            <TxHash chainId={chainId} hash={tx.hash} />
          </Row>
        )}
        {tx.status === 'failed' && (
          <Row icon={<XCircle aria-hidden className="h-5 w-5" />} title={tx.beforeSending ? 'Blocked before sending' : 'Failed'} tone="bg-red-50 text-red-900">
            {tx.message}
            {tx.beforeSending && <p className="mt-1 text-xs">MetaMask was not opened and no ETH was sent.</p>}
            {tx.hash && <TxHash chainId={chainId} hash={tx.hash} />}
          </Row>
        )}
        {tx.status === 'rejected' && (
          <Row icon={<ShieldX aria-hidden className="h-5 w-5" />} title="Rejected" tone="bg-slate-100 text-slate-800">
            {tx.message}
          </Row>
        )}
      </div>
    </Card>
  )
}
