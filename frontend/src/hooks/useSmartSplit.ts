import { Contract, type BrowserProvider } from 'ethers'
import { useCallback, useMemo, useState } from 'react'
import type { ContractDeployment } from '../config/contracts'
import { SMART_SPLIT_ABI } from '../lib/contract'
import { toFriendlyError } from '../lib/errors'
import { sumWei } from '../lib/split'
import { useAsyncData } from './useAsyncData'

export type TxState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'awaiting-signature' }
  | { status: 'pending'; hash: string }
  | { status: 'confirmed'; hash: string; blockNumber: number; gasUsed: bigint; paymentId: bigint | null }
  | { status: 'failed'; hash?: string; message: string; beforeSending: boolean }
  | { status: 'rejected'; message: string }

export interface SessionTx {
  hash: string
  chainId: number
  status: 'pending' | 'confirmed' | 'failed'
  recipientCount: number
  total: string
  time: number
  message?: string
}

const SESSION_KEY = 'smart-split:session-txs'

function loadSession(): SessionTx[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]') as SessionTx[]
  } catch {
    return []
  }
}

export function useSmartSplit(
  provider: BrowserProvider | null,
  chainId: number | null,
  deployment: ContractDeployment | null,
) {
  const [txEntry, setTxEntry] = useState<{ chainId: number | null; tx: TxState }>({ chainId, tx: { status: 'idle' } })
  const tx: TxState = txEntry.chainId === chainId ? txEntry.tx : { status: 'idle' }
  const setTx = useCallback((next: TxState) => setTxEntry({ chainId, tx: next }), [chainId])
  const [sessionTxs, setSessionTxs] = useState<SessionTx[]>(loadSession)

  const contract = useMemo(
    () => (provider && deployment ? new Contract(deployment.address, SMART_SPLIT_ABI, provider) : null),
    [provider, deployment],
  )

  const upsertSessionTx = useCallback((entry: SessionTx) => {
    setSessionTxs((prev) => {
      const next = [entry, ...prev.filter((t) => t.hash !== entry.hash)].slice(0, 20)
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
      } catch {
      }
      return next
    })
  }, [])

  const contractKey = contract && deployment ? `${chainId}:${deployment.address}` : null

  const loadPaymentCount = useCallback(async () => (await contract!.paymentCount()) as bigint, [contract])
  const paymentCountData = useAsyncData(contractKey, loadPaymentCount)
  const paymentCount = paymentCountData.value ?? null
  const refreshPaymentCount = paymentCountData.reload

  const loadGasPrice = useCallback(async () => {
    const fee = await provider!.getFeeData()
    return fee.maxFeePerGas ?? fee.gasPrice ?? null
  }, [provider])
  const gasPrice = useAsyncData(provider ? String(chainId) : null, loadGasPrice).value ?? null

  const resetTx = useCallback(() => setTx({ status: 'idle' }), [setTx])

  const sendPayment = useCallback(
    async (recipients: string[], amounts: bigint[]): Promise<boolean> => {
      if (!provider || !contract || chainId === null) return false
      const value = sumWei(amounts)
      let hash: string | undefined

      try {
        const signer = await provider.getSigner()
        const writable = contract.connect(signer) as Contract

        setTx({ status: 'checking' })
        try {
          await writable.splitPayment.staticCall(recipients, amounts, { value })
          await writable.splitPayment.estimateGas(recipients, amounts, { value })
        } catch (e) {
          const friendly = toFriendlyError(e)
          setTx({ status: 'failed', message: friendly.message, beforeSending: true })
          return false
        }

        setTx({ status: 'awaiting-signature' })
        const response = await writable.splitPayment(recipients, amounts, { value })
        hash = response.hash as string
        setTx({ status: 'pending', hash })
        const base = { hash, chainId, recipientCount: recipients.length, total: value.toString(), time: Date.now() }
        upsertSessionTx({ ...base, status: 'pending' })

        const receipt = await response.wait(1)
        if (!receipt || receipt.status !== 1) {
          const message = 'The transaction was mined but failed (reverted). No ETH was sent.'
          setTx({ status: 'failed', hash, message, beforeSending: false })
          upsertSessionTx({ ...base, status: 'failed', message })
          return false
        }

        let paymentId: bigint | null = null
        for (const log of receipt.logs) {
          const parsed = contract.interface.parseLog(log)
          if (parsed?.name === 'PaymentSplit') paymentId = parsed.args.paymentId as bigint
        }
        setTx({ status: 'confirmed', hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, paymentId })
        upsertSessionTx({ ...base, status: 'confirmed' })
        refreshPaymentCount()
        return true
      } catch (e) {
        const friendly = toFriendlyError(e)
        if (friendly.kind === 'rejected') {
          setTx({ status: 'rejected', message: friendly.message })
        } else {
          setTx({ status: 'failed', hash, message: friendly.message, beforeSending: hash === undefined })
          if (hash) {
            upsertSessionTx({
              hash, chainId, recipientCount: recipients.length, total: value.toString(),
              time: Date.now(), status: 'failed', message: friendly.message,
            })
          }
        }
        return false
      }
    },
    [provider, contract, chainId, setTx, upsertSessionTx, refreshPaymentCount],
  )

  return { contract, tx, resetTx, sendPayment, paymentCount, refreshPaymentCount, gasPrice, sessionTxs }
}
