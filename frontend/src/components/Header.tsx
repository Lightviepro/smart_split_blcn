import { Split, Wallet } from 'lucide-react'
import { isSupportedChain } from '../config/chains'
import { chainName, shortenAddress } from '../lib/format'
import { CopyButton } from './CopyButton'
import { Badge, buttonPrimary } from './ui'

interface HeaderProps {
  hasWallet: boolean
  account: string | null
  chainId: number | null
  connecting: boolean
  onConnect: () => void
}

export function Header({ hasWallet, account, chainId, connecting, onConnect }: HeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-600 p-2 text-white">
            <Split aria-hidden className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-900">Smart Split</h1>
            <p className="text-xs text-slate-500">Split one ETH payment among many people, in one transaction</p>
          </div>
          <Badge tone="amber">Testnet only — no real money</Badge>
        </div>

        <div className="flex items-center gap-2">
          {chainId !== null && (
            <Badge tone={isSupportedChain(chainId) ? 'green' : 'red'}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${isSupportedChain(chainId) ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {chainName(chainId)}
            </Badge>
          )}
          {hasWallet &&
            (account ? (
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 py-1 pl-3 pr-1 text-sm font-medium text-slate-800">
                <Wallet aria-hidden className="h-4 w-4 text-slate-500" />
                <span title={account} className="font-mono">{shortenAddress(account)}</span>
                <CopyButton text={account} />
              </div>
            ) : (
              <button type="button" className={buttonPrimary} onClick={onConnect} disabled={connecting}>
                <Wallet aria-hidden className="h-4 w-4" />
                {connecting ? 'Connecting…' : 'Connect MetaMask'}
              </button>
            ))}
        </div>
      </div>
    </header>
  )
}
