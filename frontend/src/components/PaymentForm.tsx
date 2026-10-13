import { Plus, X } from 'lucide-react'
import { formatEthExact } from '../lib/format'
import { MAX_RECIPIENTS, type FormInput, type FormValidation, type RecipientRow, type SplitMode } from '../lib/validation'
import { buttonPrimary, buttonSoft, eyebrow, iconButton, inputBase, Panel, Segmented } from './ui'

interface Props {
  form: FormInput
  validation: FormValidation
  /** Show errors on untouched/empty fields too (after the user tried to review). */
  showAllErrors: boolean
  disabled: boolean
  onChange: (form: FormInput) => void
  onAddRow: () => void
  onReview: () => void
}

const MODES = [
  { value: 'custom', label: 'Custom amounts' },
  { value: 'equal', label: 'Equal split' },
] as const satisfies readonly { value: SplitMode; label: string }[]

const invalidRing = 'ring-1 ring-danger/60'

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 pl-1 text-xs font-medium text-danger">
      {message}
    </p>
  )
}

export function PaymentForm({ form, validation, showAllErrors, disabled, onChange, onAddRow, onReview }: Props) {
  const setMode = (mode: SplitMode) => onChange({ ...form, mode })
  const updateRow = (id: string, patch: Partial<RecipientRow>) =>
    onChange({ ...form, rows: form.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const removeRow = (id: string) => onChange({ ...form, rows: form.rows.filter((r) => r.id !== id) })

  // Only nag about a field once the user typed something, or after they pressed Review.
  const visible = (value: string, error?: string) => (showAllErrors || value.trim() !== '' ? error : undefined)
  const totalError = visible(form.equalTotal, validation.totalError)
  const n = form.rows.length

  return (
    <Panel
      step={1}
      title="Who gets paid"
      labelledBy="form-title"
      subtitle={form.mode === 'custom' ? 'Enter each address and its amount.' : 'Enter one total; it is divided equally.'}
      actions={<Segmented label="Split mode" value={form.mode} options={MODES} onChange={setMode} disabled={disabled} />}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onReview()
        }}
      >
        <fieldset disabled={disabled} className="space-y-5">
          {form.mode === 'equal' && (
            <div>
              <label htmlFor="equal-total" className={eyebrow}>
                Total to split
              </label>
              <div className="relative mt-2 max-w-xs">
                <input
                  id="equal-total"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.003"
                  value={form.equalTotal}
                  onChange={(e) => onChange({ ...form, equalTotal: e.target.value })}
                  aria-invalid={!!totalError}
                  aria-describedby={totalError ? 'equal-total-error' : 'equal-total-help'}
                  className={`${inputBase} pr-14 text-base font-semibold ${totalError ? invalidRing : ''}`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-muted">ETH</span>
              </div>
              {totalError ? (
                <FieldError id="equal-total-error" message={totalError} />
              ) : (
                <p id="equal-total-help" className="mt-2 pl-1 text-xs text-muted">
                  Divided equally in wei among {n} recipient{n === 1 ? '' : 's'}. Any leftover wei goes to the first
                  recipients, so the total is exact.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2.5">
            {/* Column headings (the inputs below also have screen-reader labels). */}
            <div aria-hidden className="hidden gap-3 sm:flex">
              <span className="w-8 shrink-0" />
              <div className={`grid flex-1 grid-cols-12 gap-2.5 pl-1 ${eyebrow}`}>
                <span className="col-span-6">Recipient address</span>
                <span className="col-span-3">Label · optional</span>
                <span className="col-span-3 text-right pr-1">{form.mode === 'custom' ? 'Amount' : 'Share'}</span>
              </div>
              <span className="w-8 shrink-0" />
            </div>

            <ol className="space-y-3">
              {form.rows.map((row, i) => {
                const v = validation.rows[i] ?? {}
                const addressError = visible(row.address, v.addressError)
                const amountError = form.mode === 'custom' ? visible(row.amount, v.amountError) : undefined
                return (
                  <li key={row.id} className="flex gap-3">
                    <span aria-hidden className="float-sm mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-xs font-medium text-muted">
                      {i + 1}
                    </span>
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-12">
                      <div className="sm:col-span-6">
                        <label htmlFor={`addr-${row.id}`} className="sr-only">Recipient #{i + 1} address</label>
                        <input
                          id={`addr-${row.id}`}
                          placeholder="0x… recipient address"
                          autoComplete="off"
                          spellCheck={false}
                          value={row.address}
                          onChange={(e) => updateRow(row.id, { address: e.target.value })}
                          aria-invalid={!!addressError}
                          aria-describedby={addressError ? `addr-err-${row.id}` : undefined}
                          className={`${inputBase} font-mono text-[13px] ${addressError ? invalidRing : ''}`}
                        />
                        <FieldError id={`addr-err-${row.id}`} message={addressError} />
                      </div>
                      <div className="sm:col-span-3">
                        <label htmlFor={`label-${row.id}`} className="sr-only">Recipient #{i + 1} label (optional)</label>
                        <input
                          id={`label-${row.id}`}
                          placeholder="e.g. Rahul"
                          value={row.label}
                          maxLength={30}
                          onChange={(e) => updateRow(row.id, { label: e.target.value })}
                          className={inputBase}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        {form.mode === 'custom' ? (
                          <>
                            <label htmlFor={`amount-${row.id}`} className="sr-only">Recipient #{i + 1} amount in ETH</label>
                            <div className="relative">
                              <input
                                id={`amount-${row.id}`}
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="0.001"
                                value={row.amount}
                                onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                                aria-invalid={!!amountError}
                                aria-describedby={amountError ? `amount-err-${row.id}` : undefined}
                                className={`${inputBase} pr-12 font-semibold ${amountError ? invalidRing : ''}`}
                              />
                              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-muted">ETH</span>
                            </div>
                            <FieldError id={`amount-err-${row.id}`} message={amountError} />
                          </>
                        ) : (
                          <p
                            className="flex h-10.5 items-center justify-end rounded-2xl px-4 text-sm font-bold text-accent"
                            aria-label={`Recipient #${i + 1} share`}
                          >
                            {v.amount !== undefined ? `${formatEthExact(v.amount)} ETH` : <span className="text-faint">—</span>}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label={`Remove recipient #${i + 1}`}
                      className={`${iconButton} mt-1 hover:text-danger`}
                    >
                      <X aria-hidden className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          {(showAllErrors || n > MAX_RECIPIENTS) &&
            validation.formErrors.map((err) => (
              <p key={err} role="alert" className="text-sm font-medium text-danger">
                {err}
              </p>
            ))}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button type="button" className={buttonSoft} onClick={onAddRow} disabled={n >= MAX_RECIPIENTS}>
              <Plus aria-hidden className="h-4 w-4" />
              Add recipient
              <span className="font-mono text-xs font-medium text-muted">
                {n}/{MAX_RECIPIENTS}
              </span>
            </button>
            <button type="submit" className={buttonPrimary}>
              Review payment
            </button>
          </div>
        </fieldset>
      </form>
    </Panel>
  )
}
