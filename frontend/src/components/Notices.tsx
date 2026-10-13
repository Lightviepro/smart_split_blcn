import { AlertTriangle, Download, FileWarning } from 'lucide-react'
import { LOCAL_CHAIN_ENABLED } from '../config/chains'
import { chainName, LOCAL_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../lib/format'
import { buttonPrimary, buttonSecondary, ExternalLink } from './ui'

export function InstallMetaMask() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
      <div className="flex items-start gap-3">
        <Download aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="font-semibold">MetaMask is required</h2>
          <p className="mt-1 text-sm">
            Smart Split talks to the blockchain through the MetaMask browser extension, which keeps your keys safe and
            asks you to approve every transaction.
          </p>
          <p className="mt-3 text-sm">
            <ExternalLink href="https://metamask.io/download/">Install MetaMask</ExternalLink>, then reload this page.
          </p>
        </div>
      </div>
    </div>
  )
}

export function NetworkBanner({ chainId, onSwitch }: { chainId: number; onSwitch: (chainId: number) => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Wrong network: {chainName(chainId)}</p>
            <p className="text-sm">Smart Split runs on the Sepolia test network. Switch networks to continue.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className={buttonPrimary} onClick={() => onSwitch(SEPOLIA_CHAIN_ID)}>
            Switch to Sepolia
          </button>
          {LOCAL_CHAIN_ENABLED && (
            <button type="button" className={buttonSecondary} onClick={() => onSwitch(LOCAL_CHAIN_ID)}>
              Use Hardhat Local
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function NoContractNotice({ chainId }: { chainId: number }) {
  return (
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <div className="flex items-start gap-3">
        <FileWarning aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold">SmartSplit is not deployed on {chainName(chainId)} yet</p>
          <p className="mt-1">
            No contract address is configured for chain {chainId}. Deploy the contract, then register it with{' '}
            <code className="rounded bg-amber-100 px-1">npm run export-abi -- --address 0x… --block N --chain {chainId}</code>{' '}
            (in <code className="rounded bg-amber-100 px-1">contracts-hardhat/</code>) or{' '}
            <code className="rounded bg-amber-100 px-1">npm run deploy:local</code> for the local chain. Then reload.
          </p>
        </div>
      </div>
    </div>
  )
}
