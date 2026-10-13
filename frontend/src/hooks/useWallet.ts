import { BrowserProvider } from 'ethers'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ADD_CHAIN_PARAMS } from '../config/chains'
import { useAsyncData } from './useAsyncData'

export interface WalletState {
  /** MetaMask (or another EIP-1193 wallet) is installed. */
  hasWallet: boolean
  account: string | null
  chainId: number | null
  balance: bigint | null
  connecting: boolean
  error: string | null
  /** ethers provider backed by MetaMask — null when no wallet is installed. */
  provider: BrowserProvider | null
  connect: () => Promise<void>
  switchChain: (chainId: number) => Promise<void>
  refreshBalance: () => void
}

const toChainId = (hex: unknown) => (typeof hex === 'string' ? Number.parseInt(hex, 16) : null)

/**
 * Wallet connection through MetaMask. The private key never leaves MetaMask: we only ask it
 * for the account address and to sign transactions (the user confirms every one).
 */
export function useWallet(): WalletState {
  const ethereum = typeof window !== 'undefined' ? window.ethereum : undefined
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A fresh provider per chain: ethers providers are bound to the network they started on.
  const provider = useMemo(
    () => (ethereum && chainId !== null ? new BrowserProvider(ethereum) : null),
    [ethereum, chainId],
  )

  // Silent restore on page load: eth_accounts never opens a MetaMask popup.
  useEffect(() => {
    if (!ethereum) return
    let cancelled = false
    void (async () => {
      try {
        const [accounts, chain] = await Promise.all([
          ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>,
          ethereum.request({ method: 'eth_chainId' }),
        ])
        if (cancelled) return
        setAccount(accounts[0] ?? null)
        setChainId(toChainId(chain))
      } catch {
        // Wallet locked or unavailable — stay disconnected.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ethereum])

  // React to the user switching account or network inside MetaMask (no page reload).
  useEffect(() => {
    if (!ethereum) return
    const onAccountsChanged = (accounts: string[]) => {
      setAccount(accounts[0] ?? null)
    }
    const onChainChanged = (chain: string) => {
      setChainId(toChainId(chain))
    }
    ethereum.on('accountsChanged', onAccountsChanged)
    ethereum.on('chainChanged', onChainChanged)
    return () => {
      ethereum.removeListener('accountsChanged', onAccountsChanged)
      ethereum.removeListener('chainChanged', onChainChanged)
    }
  }, [ethereum])

  // Balance of the connected account; keyed by chain + account so a stale value never shows.
  const loadBalance = useCallback(() => provider!.getBalance(account!), [provider, account])
  const balanceData = useAsyncData(provider && account ? `${chainId}:${account}` : null, loadBalance)
  const balance = balanceData.value ?? null
  const refreshBalance = balanceData.reload

  /** Only called from the Connect button — never automatically. */
  const connect = useCallback(async () => {
    if (!ethereum) return
    setConnecting(true)
    setError(null)
    try {
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[]
      setAccount(accounts[0] ?? null)
      setChainId(toChainId(await ethereum.request({ method: 'eth_chainId' })))
    } catch (e) {
      const code = (e as { code?: number }).code
      setError(code === 4001 ? 'Connection request rejected in MetaMask.' : 'Could not connect to MetaMask.')
    } finally {
      setConnecting(false)
    }
  }, [ethereum])

  const switchChain = useCallback(
    async (target: number) => {
      if (!ethereum) return
      setError(null)
      const hexId = `0x${target.toString(16)}`
      try {
        await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] })
      } catch (e) {
        const code = (e as { code?: number }).code
        if (code === 4902 && ADD_CHAIN_PARAMS[target]) {
          // MetaMask doesn't know this network yet (typical for localhost) — offer to add it.
          try {
            await ethereum.request({ method: 'wallet_addEthereumChain', params: [ADD_CHAIN_PARAMS[target]] })
          } catch {
            setError('Could not add the network to MetaMask.')
          }
        } else if (code !== 4001) {
          setError('Could not switch network in MetaMask.')
        }
      }
    },
    [ethereum],
  )

  return {
    hasWallet: !!ethereum,
    account,
    chainId,
    balance,
    connecting,
    error,
    provider,
    connect,
    switchChain,
    refreshBalance,
  }
}
