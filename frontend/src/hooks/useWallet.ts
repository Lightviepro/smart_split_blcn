import { BrowserProvider } from 'ethers'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ADD_CHAIN_PARAMS } from '../config/chains'
import { useAsyncData } from './useAsyncData'

export interface WalletState {
  hasWallet: boolean
  account: string | null
  chainId: number | null
  balance: bigint | null
  connecting: boolean
  error: string | null
  provider: BrowserProvider | null
  connect: () => Promise<void>
  switchChain: (chainId: number) => Promise<void>
  refreshBalance: () => void
}

const toChainId = (hex: unknown) => (typeof hex === 'string' ? Number.parseInt(hex, 16) : null)

export function useWallet(): WalletState {
  const ethereum = typeof window !== 'undefined' ? window.ethereum : undefined
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const provider = useMemo(
    () => (ethereum && chainId !== null ? new BrowserProvider(ethereum) : null),
    [ethereum, chainId],
  )

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
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ethereum])

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

  const loadBalance = useCallback(() => provider!.getBalance(account!), [provider, account])
  const balanceData = useAsyncData(provider && account ? `${chainId}:${account}` : null, loadBalance)
  const balance = balanceData.value ?? null
  const refreshBalance = balanceData.reload

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
