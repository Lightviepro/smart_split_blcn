import type { ReactNode } from 'react'
import { LOCAL_CHAIN_ENABLED } from '../config/chains'
import { chainName, LOCAL_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../lib/format'
import { buttonPrimary, buttonSoft, ExternalLink } from './ui'

function Notice({ tone, title, children, actions, role = 'status' }: { tone: 'warn' | 'danger'; title: string; children: ReactNode; actions?: ReactNode; role?: 'status' | 'alert' }) {
  const bar = tone === 'danger' ? 'bg-danger' : 'bg-warn'
  return (
    <div role={role} className="float relative overflow-hidden rounded-[22px] p-5 pl-7">
      <span aria-hidden className={`absolute inset-y-4 left-0 w-1.5 rounded-r-full ${bar}`} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <p className={`font-bold ${tone === 'danger' ? 'text-danger' : 'text-warn'}`}>{title}</p>
          <div className="mt-1 text-sm text-muted">{children}</div>
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  )
}

export function InstallMetaMask() {
  return (
    <Notice tone="warn" title="MetaMask is required">
      Smart Split talks to the blockchain through the MetaMask browser extension, which keeps your keys safe and asks you
      to approve every transaction. <ExternalLink href="https://metamask.io/download/">Install MetaMask</ExternalLink>,
      then reload this page.
    </Notice>
  )
}

export function NetworkBanner({ chainId, onSwitch }: { chainId: number; onSwitch: (chainId: number) => void }) {
  return (
    <Notice
      tone="danger"
      role="alert"
      title={`Wrong network: ${chainName(chainId)}`}
      actions={
        <>
          <button type="button" className={buttonPrimary} onClick={() => onSwitch(SEPOLIA_CHAIN_ID)}>
            Switch to Sepolia
          </button>
          {LOCAL_CHAIN_ENABLED && (
            <button type="button" className={buttonSoft} onClick={() => onSwitch(LOCAL_CHAIN_ID)}>
              Use Hardhat Local
            </button>
          )}
        </>
      }
    >
      Smart Split runs on the Sepolia test network. Switch networks to continue.
    </Notice>
  )
}

export function NoContractNotice({ chainId }: { chainId: number }) {
  const code = 'rounded-md bg-surface-deep px-1.5 py-0.5 font-mono text-[12px] text-ink'
  return (
    <Notice tone="warn" title={`SmartSplit is not deployed on ${chainName(chainId)} yet`}>
      No contract address is configured for chain {chainId}. Deploy the contract, then register it with{' '}
      <code className={code}>npm run export-abi -- --address 0x… --block N --chain {chainId}</code> (in{' '}
      <code className={code}>contracts-hardhat/</code>) or <code className={code}>npm run deploy:local</code> for the
      local chain. Then reload.
    </Notice>
  )
}
