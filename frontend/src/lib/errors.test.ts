import { parseEther } from 'ethers'
import { describe, expect, it } from 'vitest'
import { SMART_SPLIT_INTERFACE as iface } from './contract'
import { describeContractError, REJECTED_MESSAGE, toFriendlyError } from './errors'

const A = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

describe('toFriendlyError', () => {
  it('detects user rejection (ethers ACTION_REJECTED and EIP-1193 code 4001)', () => {
    expect(toFriendlyError({ code: 'ACTION_REJECTED', message: 'user rejected action' })).toEqual({ kind: 'rejected', message: REJECTED_MESSAGE })
    expect(toFriendlyError({ code: 4001, message: 'User denied transaction signature.' }).kind).toBe('rejected')
    expect(toFriendlyError({ code: 'UNKNOWN_ERROR', error: { code: 4001 } }).kind).toBe('rejected')
    expect(REJECTED_MESSAGE).toBe('You rejected the transaction in MetaMask. No ETH was sent.')
  })

  it('decodes raw revert data from an ethers CALL_EXCEPTION', () => {
    const data = iface.encodeErrorResult('DuplicateRecipient', [A])
    const f = toFriendlyError({ code: 'CALL_EXCEPTION', data, revert: null })
    expect(f.kind).toBe('contract')
    expect(f.errorName).toBe('DuplicateRecipient')
    expect(f.message).toContain(A)
  })

  it('decodes revert data nested MetaMask-style (error.data.data)', () => {
    const data = iface.encodeErrorResult('IncorrectValue', [parseEther('0.01'), parseEther('0.03')])
    const f = toFriendlyError({ code: 'UNKNOWN_ERROR', error: { code: -32603, message: 'Internal JSON-RPC error.', data: { data } } })
    expect(f.errorName).toBe('IncorrectValue')
    expect(f.message).toBe('The ETH sent (0.01 ETH) does not equal the sum of the amounts (0.03 ETH).')
  })

  it("uses ethers' pre-decoded `revert` field when present", () => {
    const f = toFriendlyError({ code: 'CALL_EXCEPTION', revert: { name: 'ZeroAmount', args: [2n], signature: 'ZeroAmount(uint256)' } })
    expect(f).toEqual({ kind: 'contract', errorName: 'ZeroAmount', message: 'Recipient #3 has an amount of 0. Every amount must be greater than 0.' })
  })

  it('recognises insufficient funds', () => {
    expect(toFriendlyError({ code: 'INSUFFICIENT_FUNDS', message: 'insufficient funds for intrinsic transaction cost' }).kind).toBe('insufficient-funds')
  })

  it('falls back to shortMessage / message', () => {
    expect(toFriendlyError({ shortMessage: 'network error', message: 'long text' })).toEqual({ kind: 'unknown', message: 'network error' })
    expect(toFriendlyError(new Error('boom')).message).toBe('boom')
    expect(toFriendlyError('weird').message).toBe('weird')
  })

  it('ignores revert data that is not a SmartSplit error', () => {
    const f = toFriendlyError({ code: 'CALL_EXCEPTION', data: '0x12345678', shortMessage: 'execution reverted' })
    expect(f).toEqual({ kind: 'unknown', message: 'execution reverted' })
  })
})

describe('describeContractError', () => {
  it('has a human message for every custom error in the ABI', () => {
    const names: string[] = []
    iface.forEachError((e) => names.push(e.name))
    expect(names).toHaveLength(12)
    for (const name of names) {
      const args = iface.getError(name)!.inputs.map((input) => (input.type === 'address' ? A : 1n))
      const msg = describeContractError(name, args)
      expect(msg, name).not.toMatch(/The contract rejected the transaction \(/)
      expect(msg.length).toBeGreaterThan(10)
    }
  })

  it('formats specific errors', () => {
    expect(describeContractError('TooManyRecipients', [21n, 20n])).toBe('Too many recipients (21). The maximum is 20.')
    expect(describeContractError('SenderAsRecipient', [0n])).toMatch(/^Recipient #1 is your own address/)
    expect(describeContractError('TransferFailed', [A, parseEther('0.001')])).toMatch(/0.001 ETH to 0x7099.*nobody was paid/)
    expect(describeContractError('SomethingElse', [])).toBe('The contract rejected the transaction (SomethingElse).')
  })
})
