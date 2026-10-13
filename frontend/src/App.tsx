import { useCallback, useMemo, useState } from 'react'
import { DashboardCards } from './components/DashboardCards'
import { Header } from './components/Header'
import { HistoryPanel } from './components/HistoryPanel'
import { InstallMetaMask, NetworkBanner, NoContractNotice } from './components/Notices'
import { PaymentForm } from './components/PaymentForm'
import { PaymentSummary } from './components/PaymentSummary'
import { ReviewModal } from './components/ReviewModal'
import { TxStatusPanel } from './components/TxStatusPanel'
import { getDeployment, isSupportedChain } from './config/chains'
import { usePaymentHistory, type HistoryFilter } from './hooks/usePaymentHistory'
import { useSmartSplit } from './hooks/useSmartSplit'
import { useWallet } from './hooks/useWallet'
import { estimateGasUpperBound, sumWei } from './lib/split'
import { validateForm, type FormInput, type RecipientRow } from './lib/validation'

let nextRowId = 0
const emptyRow = (): RecipientRow => ({ id: `row-${nextRowId++}`, address: '', label: '', amount: '' })
const emptyForm = (): FormInput => ({ mode: 'custom', equalTotal: '', rows: [emptyRow()] })

export default function App() {
  const wallet = useWallet()
  const deployment = getDeployment(wallet.chainId)
  const smartSplit = useSmartSplit(wallet.provider, wallet.chainId, deployment)

  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const history = usePaymentHistory(wallet.provider, smartSplit.contract, deployment?.deployBlock ?? null, wallet.account, historyFilter)

  const [form, setForm] = useState<FormInput>(emptyForm)
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const validation = useMemo(
    () => validateForm(form, { contractAddress: deployment?.address, senderAddress: wallet.account }),
    [form, deployment?.address, wallet.account],
  )
  // Running total of whatever amounts are valid so far (for the summary while typing).
  const draftTotal = sumWei(validation.rows.flatMap((r) => (r.amount !== undefined ? [r.amount] : [])))
  const estimatedGasCost =
    smartSplit.gasPrice !== null ? estimateGasUpperBound(form.rows.length, wallet.chainId) * smartSplit.gasPrice : null

  const busy = smartSplit.tx.status === 'checking' || smartSplit.tx.status === 'awaiting-signature' || smartSplit.tx.status === 'pending'
  const ready = wallet.account !== null && deployment !== null

  const onReview = () => {
    setShowAllErrors(true)
    if (validation.isValid && ready) setReviewOpen(true)
  }

  const closeReview = useCallback(() => setReviewOpen(false), [])

  const onConfirm = async () => {
    setReviewOpen(false)
    const confirmed = await smartSplit.sendPayment(validation.recipients, validation.amounts)
    if (confirmed) {
      setForm(emptyForm())
      setShowAllErrors(false)
      wallet.refreshBalance()
      history.refresh()
    }
  }

  const chainId = wallet.chainId
  const supported = isSupportedChain(chainId)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header
        hasWallet={wallet.hasWallet}
        account={wallet.account}
        chainId={chainId}
        connecting={wallet.connecting}
        onConnect={() => void wallet.connect()}
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {!wallet.hasWallet && <InstallMetaMask />}
        {wallet.error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {wallet.error}
          </p>
        )}
        {chainId !== null && !supported && <NetworkBanner chainId={chainId} onSwitch={(id) => void wallet.switchChain(id)} />}
        {supported && deployment === null && <NoContractNotice chainId={chainId} />}

        {wallet.hasWallet && (
          <DashboardCards
            balance={wallet.balance}
            account={wallet.account}
            chainId={chainId}
            contractAddress={deployment?.address ?? null}
            paymentCount={smartSplit.paymentCount}
          />
        )}

        {supported && deployment !== null && (
          <>
            {!wallet.account && (
              <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
                Connect MetaMask (top right) to send a payment. You can still browse the payment history below.
              </p>
            )}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <PaymentForm
                  form={form}
                  validation={validation}
                  showAllErrors={showAllErrors}
                  disabled={busy || !wallet.account}
                  onChange={setForm}
                  onAddRow={() => setForm((f) => ({ ...f, rows: [...f.rows, emptyRow()] }))}
                  onReview={onReview}
                />
              </div>
              <div className="space-y-6 lg:col-span-2">
                <TxStatusPanel tx={smartSplit.tx} chainId={chainId} onReset={smartSplit.resetTx} />
                <PaymentSummary
                  rowCount={form.rows.length}
                  draftTotal={draftTotal}
                  balance={wallet.balance}
                  estimatedGasCost={estimatedGasCost}
                />
              </div>
            </div>

            <HistoryPanel
              chainId={chainId}
              account={wallet.account}
              filter={historyFilter}
              onFilterChange={setHistoryFilter}
              records={history.records}
              loading={history.loading}
              progress={history.progress}
              error={history.error}
              onRefresh={history.refresh}
              sessionTxs={smartSplit.sessionTxs}
            />

            <ReviewModal
              open={reviewOpen}
              chainId={chainId}
              contractAddress={deployment.address}
              recipients={validation.recipients}
              labels={form.rows.map((r) => r.label.trim())}
              amounts={validation.amounts}
              total={validation.total}
              onCancel={closeReview}
              onConfirm={() => void onConfirm()}
            />
          </>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-slate-500">
        Smart Split · Blockchain Lab project · Runs on the Sepolia testnet. Test ETH has no real-world value.
      </footer>
    </div>
  )
}
