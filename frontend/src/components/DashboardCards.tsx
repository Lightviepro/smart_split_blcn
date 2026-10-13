import type { ReactNode } from 'react'
import { addressUrl, chainName, formatEth, shortenAddress } from '../lib/format'
import { CopyButton } from './CopyButton'
import { ExternalLink } from './ui'

interface Props {
  balance: bigint | null
  account: string | null
  chainId: number | null
  contractAddress: string | null
  paymentCount: bigint | null
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-lg font-semibold text-slate-900">{children}</dd>
    </div>
  )
}

export function DashboardCards({ balance, account, chainId, contractAddress, paymentCount }: Props) {
  const explorer = contractAddress ? addressUrl(chainId, contractAddress) : null
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Wallet balance">
        {!account ? <span className="text-slate-400">Not connected</span> : balance === null ? '…' : `${formatEth(balance, 4)} ETH`}
      </Stat>
      <Stat label="Network">{chainId === null ? <span className="text-slate-400">—</span> : chainName(chainId)}</Stat>
      <Stat label="Contract">
        {contractAddress ? (
          <span className="flex items-center gap-1 text-base">
            {explorer ? (
              <ExternalLink href={explorer}>
                <span className="font-mono">{shortenAddress(contractAddress)}</span>
              </ExternalLink>
            ) : (
              <span className="font-mono" title={contractAddress}>{shortenAddress(contractAddress)}</span>
            )}
            <CopyButton text={contractAddress} label="Copy contract address" />
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </Stat>
      <Stat label="Total payments (on-chain)">{paymentCount === null ? <span className="text-slate-400">—</span> : paymentCount.toString()}</Stat>
    </dl>
  )
}
