import { Plus, Trash2 } from 'lucide-react'
import { formatEthExact } from '../lib/format'
import { MAX_RECIPIENTS, type FormInput, type FormValidation, type RecipientRow, type SplitMode } from '../lib/validation'
import { buttonPrimary, buttonSecondary, Card, inputBase } from './ui'

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

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
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

  return (
    <Card
      title="New split payment"
      actions={
        <div role="radiogroup" aria-label="Split mode" className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          {(['custom', 'equal'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={form.mode === mode}
              disabled={disabled}
              onClick={() => setMode(mode)}
              className={`rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                form.mode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode === 'custom' ? 'Custom amounts' : 'Equal split'}
            </button>
          ))}
        </div>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onReview()
        }}
      >
        <fieldset disabled={disabled} className="space-y-4">
          {form.mode === 'equal' && (
            <div>
              <label htmlFor="equal-total" className="block text-sm font-medium text-slate-700">
                Total to split (ETH)
              </label>
              <input
                id="equal-total"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.003"
                value={form.equalTotal}
                onChange={(e) => onChange({ ...form, equalTotal: e.target.value })}
                aria-invalid={!!totalError}
                aria-describedby={totalError ? 'equal-total-error' : 'equal-total-help'}
                className={`${inputBase} mt-1 max-w-xs ${totalError ? 'ring-red-400' : 'ring-slate-300'}`}
              />
              {totalError ? (
                <FieldError id="equal-total-error" message={totalError} />
              ) : (
                <p id="equal-total-help" className="mt-1 text-xs text-slate-500">
                  Divided equally in wei among {form.rows.length} recipient{form.rows.length === 1 ? '' : 's'}. Any
                  leftover wei goes to the first recipients, so the total is exact.
                </p>
              )}
            </div>
          )}

          <ol className="space-y-3">
            {form.rows.map((row, i) => {
              const v = validation.rows[i] ?? {}
              const addressError = visible(row.address, v.addressError)
              const amountError = form.mode === 'custom' ? visible(row.amount, v.amountError) : undefined
              return (
                <li key={row.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recipient #{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label={`Remove recipient #${i + 1}`}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-indigo-500"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
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
                        className={`${inputBase} font-mono ${addressError ? 'ring-red-400' : 'ring-slate-300'}`}
                      />
                      <FieldError id={`addr-err-${row.id}`} message={addressError} />
                    </div>
                    <div className="sm:col-span-3">
                      <label htmlFor={`label-${row.id}`} className="sr-only">Recipient #{i + 1} label (optional)</label>
                      <input
                        id={`label-${row.id}`}
                        placeholder="Label (optional)"
                        value={row.label}
                        maxLength={30}
                        onChange={(e) => updateRow(row.id, { label: e.target.value })}
                        className={`${inputBase} ring-slate-300`}
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
                              className={`${inputBase} pr-12 ${amountError ? 'ring-red-400' : 'ring-slate-300'}`}
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">ETH</span>
                          </div>
                          <FieldError id={`amount-err-${row.id}`} message={amountError} />
                        </>
                      ) : (
                        <p className="flex h-full items-center rounded-lg bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-inset ring-slate-200" aria-label={`Recipient #${i + 1} share`}>
                          {v.amount !== undefined ? `${formatEthExact(v.amount)} ETH` : '—'}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          {(showAllErrors || form.rows.length > MAX_RECIPIENTS) &&
            validation.formErrors.map((err) => (
              <p key={err} role="alert" className="text-sm text-red-600">
                {err}
              </p>
            ))}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button type="button" className={buttonSecondary} onClick={onAddRow} disabled={form.rows.length >= MAX_RECIPIENTS}>
              <Plus aria-hidden className="h-4 w-4" />
              Add recipient
              <span className="text-xs text-slate-500">
                ({form.rows.length}/{MAX_RECIPIENTS})
              </span>
            </button>
            <button type="submit" className={buttonPrimary}>
              Review payment
            </button>
          </div>
        </fieldset>
      </form>
    </Card>
  )
}
