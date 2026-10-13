import { isSupportedChain } from '../config/chains'
import { chainName, shortenAddress } from '../lib/format'
import { CopyButton } from './CopyButton'
import { Logo } from './Logo'
import { buttonPrimary, Chip } from './ui'

interface HeaderProps {
  hasWallet: boolean
  account: string | null
  chainId: number | null
  connecting: boolean
  onConnect: () => void
}

export function Header({ hasWallet, account, chainId, connecting, onConnect }: HeaderProps) {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 pt-6 pb-2 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="float-sm grid h-12 w-12 place-items-center rounded-2xl">
          <Logo />
        </div>
        <div>
          <h1 className="text-xl font-extrabold leading-none tracking-tight text-ink">Smart Split</h1>
          <p className="mt-1 text-[13px] text-muted">One payment, many recipients, one transaction.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-warn">Testnet only — no real money</span>
        {chainId !== null && (
          <Chip tone={isSupportedChain(chainId) ? 'success' : 'danger'}>{chainName(chainId)}</Chip>
        )}
        {hasWallet &&
          (account ? (
            <div className="float-sm flex items-center gap-1 rounded-full py-1 pl-4 pr-1.5">
              <span className="sr-only">Connected account</span>
              <span title={account} className="font-mono text-[13px] font-medium text-ink">
                {shortenAddress(account)}
              </span>
              <CopyButton text={account} />
            </div>
          ) : (
            <button type="button" className={buttonPrimary} onClick={onConnect} disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect MetaMask'}
            </button>
          ))}
      </div>
    </header>
  )
}
