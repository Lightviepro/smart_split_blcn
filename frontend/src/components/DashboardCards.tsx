import type { ReactNode } from 'react'
import { addressUrl, chainName, formatEth, shortenAddress } from '../lib/format'
import { CopyButton } from './CopyButton'
import { eyebrow, ExternalLink } from './ui'

interface Props {
  balance: bigint | null
  account: string | null
  chainId: number | null
  contractAddress: string | null
  paymentCount: bigint | null
}

const CELL_BORDERS = [
  '',
  'border-l',
  'border-t lg:border-t-0 lg:border-l',
  'border-l border-t lg:border-t-0',
]

function Stat({ label, index, children }: { label: string; index: number; children: ReactNode }) {
  return (
    <div className={`min-w-0 border-line px-5 py-4 sm:px-6 ${CELL_BORDERS[index]}`}>
      <dt className={eyebrow}>{label}</dt>
      <dd className="mt-1.5 truncate text-lg font-bold text-ink">{children}</dd>
    </div>
  )
}

const dash = <span className="font-medium text-faint">—</span>

export function DashboardCards({ balance, account, chainId, contractAddress, paymentCount }: Props) {
  const explorer = contractAddress ? addressUrl(chainId, contractAddress) : null
  return (
    <dl className="float grid grid-cols-2 overflow-hidden rounded-[26px] lg:grid-cols-4">
      <Stat index={0} label="Your balance">
        {!account ? <span className="text-base font-medium text-faint">Not connected</span> : balance === null ? '…' : (
          <>
            {formatEth(balance, 4)} <span className="text-sm font-semibold text-muted">ETH</span>
          </>
        )}
      </Stat>
      <Stat index={1} label="Network">{chainId === null ? dash : chainName(chainId)}</Stat>
      <Stat index={2} label="Contract">
        {contractAddress ? (
          <span className="flex items-center gap-1 text-[15px]">
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
          dash
        )}
      </Stat>
      <Stat index={3} label="Payments on-chain">{paymentCount === null ? dash : paymentCount.toString()}</Stat>
    </dl>
  )
}
