import { ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { chainName, formatEthExact } from '../lib/format'
import { buttonPrimary, buttonSecondary } from './ui'

interface Props {
  open: boolean
  chainId: number
  contractAddress: string
  recipients: string[]
  labels: string[]
  amounts: bigint[]
  total: bigint
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Final check before MetaMask opens. The user must tick the checkbox to confirm they have read
 * every full address — the safeguard against paying an unintended recipient.
 */
export function ReviewModal(props: Props) {
  if (!props.open) return null
  return <ReviewDialog {...props} />
}

function ReviewDialog({ chainId, contractAddress, recipients, labels, amounts, total, onCancel, onConfirm }: Props) {
  const [checked, setChecked] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Keyboard support: Escape closes, Tab stays inside the dialog, focus returns afterwards.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>('input[type="checkbox"]')?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="review-title" className="text-lg font-semibold text-slate-900">Review payment</h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <dl className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Network</dt>
              <dd className="font-medium text-slate-900">{chainName(chainId)} (chain {chainId})</dd>
            </div>
            <div>
              <dt className="text-slate-500">SmartSplit contract</dt>
              <dd className="break-all font-mono text-xs text-slate-900">{contractAddress}</dd>
            </div>
          </dl>

          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recipients and amounts</caption>
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-2">#</th>
                <th scope="col" className="py-2 pr-2">Recipient (full address)</th>
                <th scope="col" className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recipients.map((address, i) => (
                <tr key={address}>
                  <td className="py-2 pr-2 align-top text-slate-500">{i + 1}</td>
                  <td className="py-2 pr-2">
                    {labels[i] && <div className="text-xs font-medium text-slate-700">{labels[i]}</div>}
                    <div className="break-all font-mono text-xs text-slate-900">{address}</div>
                  </td>
                  <td className="whitespace-nowrap py-2 text-right align-top font-medium">{formatEthExact(amounts[i])} ETH</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td colSpan={2} className="py-2 font-semibold">Total (sent with the transaction)</td>
                <td className="whitespace-nowrap py-2 text-right font-semibold">{formatEthExact(total)} ETH</td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-3 text-xs text-slate-500">
            Blockchain payments cannot be undone. MetaMask will also show the gas fee before you confirm.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500"
            />
            I have checked the recipient addresses
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonSecondary} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className={buttonPrimary} disabled={!checked} onClick={onConfirm}>
              <ShieldCheck aria-hidden className="h-4 w-4" />
              Confirm in MetaMask
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
