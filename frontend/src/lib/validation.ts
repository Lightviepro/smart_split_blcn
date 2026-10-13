import { getAddress, parseEther, ZeroAddress } from 'ethers'
import { equalSplit, sumWei } from './split'

export const MAX_RECIPIENTS = 20

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Parse an ETH amount typed by the user into wei (bigint), using ethers.parseEther only.
 * Rejects: empty, negative, scientific notation, more than 18 decimals, anything non-numeric.
 */
export function parseEthAmount(input: string, { allowZero = false } = {}): Result<bigint> {
  const text = input.trim()
  if (text === '') return { ok: false, error: 'Enter an amount' }
  if (text.startsWith('-')) return { ok: false, error: 'Amount cannot be negative' }
  if (/e/i.test(text)) return { ok: false, error: 'Scientific notation is not supported (write 0.001, not 1e-3)' }
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(text)) return { ok: false, error: 'Enter a number like 0.01' }

  const fraction = text.split('.')[1] ?? ''
  if (fraction.length > 18) return { ok: false, error: 'ETH has at most 18 decimal places' }

  const normalised = (text.startsWith('.') ? `0${text}` : text).replace(/\.$/, '')
  const wei = parseEther(normalised)
  if (!allowZero && wei === 0n) return { ok: false, error: 'Amount must be greater than 0' }
  return { ok: true, value: wei }
}

export interface AddressContext {
  /** The SmartSplit contract address on the current chain (cannot be a recipient). */
  contractAddress?: string | null
  /** The connected wallet (cannot pay itself). */
  senderAddress?: string | null
}

const sameAddress = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase()

/** Validate one recipient address. Returns the checksummed address on success. */
export function validateAddress(input: string, ctx: AddressContext = {}): Result<string> {
  const text = input.trim()
  if (text === '') return { ok: false, error: 'Enter an address' }
  if (!/^0x[0-9a-fA-F]{40}$/.test(text)) {
    return { ok: false, error: 'Not a valid address (expected 0x followed by 40 hex characters)' }
  }

  let checksummed: string
  try {
    // getAddress accepts all-lowercase / all-uppercase, and REJECTS mixed case whose
    // EIP-55 checksum is wrong — that usually means a typo in a copied address.
    checksummed = getAddress(text)
  } catch {
    return { ok: false, error: 'Checksum mismatch — this address has a typo (check upper/lower case letters)' }
  }

  if (checksummed === ZeroAddress) return { ok: false, error: 'The zero address cannot receive payments (ETH would be lost)' }
  if (sameAddress(checksummed, ctx.contractAddress)) return { ok: false, error: 'This is the SmartSplit contract itself' }
  if (sameAddress(checksummed, ctx.senderAddress)) return { ok: false, error: 'This is your own connected address' }
  return { ok: true, value: checksummed }
}

// ---------------------------------------------------------------------------
// Whole-form validation
// ---------------------------------------------------------------------------

export type SplitMode = 'custom' | 'equal'

export interface RecipientRow {
  id: string
  address: string
  /** Local-only nickname, never sent on-chain. */
  label: string
  /** Used in custom mode only. */
  amount: string
}

export interface FormInput {
  mode: SplitMode
  rows: RecipientRow[]
  /** Used in equal mode only. */
  equalTotal: string
}

export interface RowValidation {
  addressError?: string
  amountError?: string
  /** Checksummed address when valid. */
  address?: string
  /** Wei amount (typed in custom mode, computed in equal mode). */
  amount?: bigint
}

export interface FormValidation {
  rows: RowValidation[]
  /** Error for the "total" field in equal mode. */
  totalError?: string
  /** Errors not tied to a single field. */
  formErrors: string[]
  isValid: boolean
  /** Ready-to-send arrays (only meaningful when isValid). */
  recipients: string[]
  amounts: bigint[]
  total: bigint
}

export function validateForm(input: FormInput, ctx: AddressContext = {}): FormValidation {
  const n = input.rows.length
  const formErrors: string[] = []
  if (n === 0) formErrors.push('Add at least one recipient')
  if (n > MAX_RECIPIENTS) formErrors.push(`At most ${MAX_RECIPIENTS} recipients per payment`)

  const rows: RowValidation[] = input.rows.map((row) => {
    const result = validateAddress(row.address, ctx)
    return result.ok ? { address: result.value } : { addressError: result.error }
  })

  // Duplicates (case-insensitive): flag every later occurrence and point to the first one.
  const firstSeen = new Map<string, number>()
  rows.forEach((r, i) => {
    if (!r.address) return
    const key = r.address.toLowerCase()
    const first = firstSeen.get(key)
    if (first === undefined) firstSeen.set(key, i)
    else {
      r.addressError = `Duplicate of recipient #${first + 1}`
      r.address = undefined
    }
  })

  let totalError: string | undefined
  if (input.mode === 'custom') {
    input.rows.forEach((row, i) => {
      const parsed = parseEthAmount(row.amount)
      if (parsed.ok) rows[i].amount = parsed.value
      else rows[i].amountError = parsed.error
    })
  } else {
    const parsed = parseEthAmount(input.equalTotal)
    if (!parsed.ok) totalError = parsed.error
    else if (n > 0 && parsed.value < BigInt(n)) {
      totalError = `Total is too small to give each of ${n} recipients at least 1 wei`
    } else if (n > 0) {
      equalSplit(parsed.value, n).forEach((amount, i) => (rows[i].amount = amount))
    }
  }

  const isValid =
    formErrors.length === 0 &&
    totalError === undefined &&
    rows.every((r) => r.address !== undefined && r.amount !== undefined && !r.addressError && !r.amountError)

  const recipients = isValid ? rows.map((r) => r.address!) : []
  const amounts = isValid ? rows.map((r) => r.amount!) : []
  return { rows, totalError, formErrors, isValid, recipients, amounts, total: sumWei(amounts) }
}
