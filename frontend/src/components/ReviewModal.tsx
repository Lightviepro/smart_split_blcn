import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { chainName, formatEthExact } from '../lib/format'
import { buttonPrimary, buttonSoft, eyebrow, iconButton } from './ui'

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

export function ReviewModal(props: Props) {
  if (!props.open) return null
  return <ReviewDialog {...props} />
}

function ReviewDialog({ chainId, contractAddress, recipients, labels, amounts, total, onCancel, onConfirm }: Props) {
  const [checked, setChecked] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#d9ccf7]/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="float flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="well-sm mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs font-medium text-accent">2</span>
            <div>
              <h2 id="review-title" className="text-lg font-bold tracking-tight text-ink">Review payment</h2>
              <p className="text-sm text-muted">Blockchain payments cannot be undone. Check every address.</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className={iconButton}>
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-2">
          <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="well rounded-2xl px-4 py-3">
              <dt className={eyebrow}>Network</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{chainName(chainId)} (chain {chainId})</dd>
            </div>
            <div className="well rounded-2xl px-4 py-3">
              <dt className={eyebrow}>SmartSplit contract</dt>
              <dd className="mt-1 break-all font-mono text-[12px] text-ink">{contractAddress}</dd>
            </div>
          </dl>

          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recipients and amounts</caption>
            <thead>
              <tr className={eyebrow}>
                <th scope="col" className="w-8 py-2 font-bold">#</th>
                <th scope="col" className="py-2 font-bold">Recipient (full address)</th>
                <th scope="col" className="py-2 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((address, i) => (
                <tr key={address} className="border-t border-line">
                  <td className="py-2.5 align-top font-mono text-xs text-muted">{i + 1}</td>
                  <td className="py-2.5 pr-3">
                    {labels[i] && <div className="text-xs font-bold text-ink">{labels[i]}</div>}
                    <div className="break-all font-mono text-[12.5px] text-ink">{address}</div>
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right align-top font-bold text-ink">{formatEthExact(amounts[i])} ETH</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-strong">
                <td colSpan={2} className="py-3 font-bold text-ink">Total sent with the transaction</td>
                <td className="whitespace-nowrap py-3 text-right text-base font-extrabold text-accent">{formatEthExact(total)} ETH</td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-1 text-xs text-muted">MetaMask will show the gas fee before you confirm.</p>
        </div>

        <div className="space-y-4 px-6 pt-4 pb-6">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="focus-ring well grid h-6 w-6 ring-1 ring-line-strong checked:ring-accent shrink-0 cursor-pointer appearance-none place-content-center rounded-lg transition-colors checked:bg-accent checked:shadow-none before:hidden before:h-3 before:w-3 before:bg-white before:[clip-path:polygon(14%_44%,0_65%,50%_100%,100%_16%,80%_0,43%_62%)] checked:before:block"
            />
            I have checked the recipient addresses
          </label>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className={buttonSoft} onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className={buttonPrimary} disabled={!checked} onClick={onConfirm}>
              Confirm in MetaMask
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
