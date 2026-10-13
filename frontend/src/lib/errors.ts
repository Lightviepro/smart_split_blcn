import type { Interface } from 'ethers'
import { formatEthExact } from './format'
import { SMART_SPLIT_INTERFACE } from './contract'

export type ErrorKind = 'rejected' | 'contract' | 'insufficient-funds' | 'unknown'

export interface FriendlyError {
  kind: ErrorKind
  message: string
  /** Custom error name when the contract reverted with one, e.g. "DuplicateRecipient". */
  errorName?: string
}

export const REJECTED_MESSAGE = 'You rejected the transaction in MetaMask. No ETH was sent.'

/** Plain-English messages for each SmartSplit custom error. Indexes are shown 1-based. */
export function describeContractError(name: string, args: readonly unknown[]): string {
  const n = (v: unknown) => Number(v as bigint) + 1
  const eth = (v: unknown) => `${formatEthExact(v as bigint)} ETH`
  switch (name) {
    case 'NoRecipients':
      return 'Add at least one recipient.'
    case 'TooManyRecipients':
      return `Too many recipients (${String(args[0])}). The maximum is ${String(args[1])}.`
    case 'LengthMismatch':
      return `The recipient list (${String(args[0])}) and amount list (${String(args[1])}) have different lengths.`
    case 'ZeroAddress':
      return `Recipient #${n(args[0])} is the zero address — ETH sent there would be lost forever.`
    case 'ContractAsRecipient':
      return `Recipient #${n(args[0])} is the SmartSplit contract itself, which cannot receive payments.`
    case 'SenderAsRecipient':
      return `Recipient #${n(args[0])} is your own address — you cannot pay yourself.`
    case 'ZeroAmount':
      return `Recipient #${n(args[0])} has an amount of 0. Every amount must be greater than 0.`
    case 'DuplicateRecipient':
      return `${String(args[0])} appears more than once. Each recipient may appear only once.`
    case 'IncorrectValue':
      return `The ETH sent (${eth(args[0])}) does not equal the sum of the amounts (${eth(args[1])}).`
    case 'ReentrantCall':
      return 'The contract blocked a nested (re-entrant) call.'
    case 'TransferFailed':
      return `Sending ${eth(args[1])} to ${String(args[0])} failed — that address refused the ETH. Because payments are all-or-nothing, nobody was paid.`
    case 'DirectPaymentNotAccepted':
      return 'The contract does not accept direct ETH transfers. Use the payment form.'
    default:
      return `The contract rejected the transaction (${name}).`
  }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null

/** Walk the nested error objects that ethers / MetaMask produce, depth-first. */
function* walk(error: unknown, depth = 0): Generator<Obj> {
  if (!isObj(error) || depth > 6) return
  yield error
  for (const key of ['error', 'info', 'data', 'cause', 'originalError']) {
    if (isObj(error[key])) yield* walk(error[key], depth + 1)
  }
}

/** Find revert data (0x + 4-byte selector + args) anywhere inside the error. */
function findRevertData(error: unknown): string | undefined {
  for (const e of walk(error)) {
    const data = e.data
    if (typeof data === 'string' && /^0x[0-9a-fA-F]{8}/.test(data)) return data
    if (isObj(data) && typeof data.data === 'string' && /^0x[0-9a-fA-F]{8}/.test(data.data)) return data.data
  }
  return undefined
}

function isUserRejection(error: unknown): boolean {
  for (const e of walk(error)) {
    if (e.code === 'ACTION_REJECTED' || e.code === 4001) return true
  }
  return false
}

function isInsufficientFunds(error: unknown): boolean {
  for (const e of walk(error)) {
    if (e.code === 'INSUFFICIENT_FUNDS') return true
    if (typeof e.message === 'string' && /insufficient funds/i.test(e.message)) return true
  }
  return false
}

/**
 * Turn any error thrown by ethers/MetaMask while sending a split into a message a person can
 * act on. Contract custom errors are decoded with the SmartSplit ABI.
 */
export function toFriendlyError(error: unknown, iface: Interface = SMART_SPLIT_INTERFACE): FriendlyError {
  if (isUserRejection(error)) return { kind: 'rejected', message: REJECTED_MESSAGE }

  // ethers v6 attaches the decoded custom error as `revert` when it knows the ABI.
  for (const e of walk(error)) {
    const revert = e.revert
    if (isObj(revert) && typeof revert.name === 'string' && Array.isArray(revert.args)) {
      return { kind: 'contract', errorName: revert.name, message: describeContractError(revert.name, revert.args) }
    }
  }

  const data = findRevertData(error)
  if (data) {
    try {
      const parsed = iface.parseError(data)
      if (parsed) {
        return { kind: 'contract', errorName: parsed.name, message: describeContractError(parsed.name, parsed.args) }
      }
    } catch {
      // Not one of our errors; fall through.
    }
  }

  if (isInsufficientFunds(error)) {
    return { kind: 'insufficient-funds', message: 'Your wallet does not have enough ETH to cover the payment plus gas.' }
  }

  for (const e of walk(error)) {
    if (typeof e.shortMessage === 'string') return { kind: 'unknown', message: e.shortMessage }
  }
  const message = isObj(error) && typeof error.message === 'string' ? error.message : String(error)
  return { kind: 'unknown', message }
}
