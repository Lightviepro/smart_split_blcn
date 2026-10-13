import { parseEther, ZeroAddress } from 'ethers'
import { describe, expect, it } from 'vitest'
import { parseEthAmount, validateAddress, validateForm, type RecipientRow } from './validation'

const A = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const B = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const C = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const CONTRACT = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

const row = (address: string, amount = '', label = ''): RecipientRow => ({ id: address + amount, address, amount, label })

describe('parseEthAmount', () => {
  it('parses valid amounts into wei using parseEther', () => {
    expect(parseEthAmount('0.01')).toEqual({ ok: true, value: parseEther('0.01') })
    expect(parseEthAmount('1')).toEqual({ ok: true, value: parseEther('1') })
    expect(parseEthAmount(' 2.5 ')).toEqual({ ok: true, value: parseEther('2.5') })
    expect(parseEthAmount('.5')).toEqual({ ok: true, value: parseEther('0.5') })
    expect(parseEthAmount('1.')).toEqual({ ok: true, value: parseEther('1') })
    expect(parseEthAmount('0.000000000000000001')).toEqual({ ok: true, value: 1n })
  })

  it('avoids floating point errors (0.1 + 0.2 style)', () => {
    const r = parseEthAmount('0.3')
    expect(r.ok && r.value).toBe(300000000000000000n)
  })

  it('rejects empty, negative, scientific, >18 decimals, garbage and zero', () => {
    for (const bad of ['', '   ', '-1', '-0.5', '1e-3', '1E5', '0.0000000000000000001', 'abc', '1,5', '0x10', '1.2.3', '0', '0.000']) {
      expect(parseEthAmount(bad).ok, bad).toBe(false)
    }
    expect(parseEthAmount('0', { allowZero: true })).toEqual({ ok: true, value: 0n })
  })

  it('gives specific messages', () => {
    const msg = (s: string) => {
      const r = parseEthAmount(s)
      return r.ok ? '' : r.error
    }
    expect(msg('')).toMatch(/Enter an amount/)
    expect(msg('-1')).toMatch(/negative/)
    expect(msg('1e18')).toMatch(/Scientific/)
    expect(msg('0.1234567890123456789')).toMatch(/18 decimal/)
    expect(msg('0')).toMatch(/greater than 0/)
  })
})

describe('validateAddress', () => {
  it('accepts checksummed, lowercase and uppercase addresses and returns the checksum form', () => {
    expect(validateAddress(A)).toEqual({ ok: true, value: A })
    expect(validateAddress(A.toLowerCase())).toEqual({ ok: true, value: A })
    expect(validateAddress('0x' + A.slice(2).toUpperCase())).toEqual({ ok: true, value: A })
  })

  it('rejects malformed addresses', () => {
    for (const bad of ['', '0x123', A.slice(2), A + '00', '0xZZ997970C51812dc3A010C7d01b50e0d17dc79C8']) {
      expect(validateAddress(bad).ok, bad).toBe(false)
    }
  })

  it('rejects a mixed-case address with a bad checksum', () => {
    const typo = A.replace('C51812dc', 'c51812dc') // flip the case of one letter
    const r = validateAddress(typo)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/Checksum/)
  })

  it('rejects zero address, the contract and the sender (case-insensitive)', () => {
    const ctx = { contractAddress: CONTRACT, senderAddress: SENDER }
    expect(validateAddress(ZeroAddress, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/zero address/) })
    expect(validateAddress(CONTRACT.toLowerCase(), ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/contract/) })
    expect(validateAddress(SENDER.toLowerCase(), ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/your own/) })
  })
})

describe('validateForm', () => {
  it('custom mode: valid form produces arrays and total', () => {
    const v = validateForm({ mode: 'custom', equalTotal: '', rows: [row(A, '0.01'), row(B, '0.02')] })
    expect(v.isValid).toBe(true)
    expect(v.recipients).toEqual([A, B])
    expect(v.amounts).toEqual([parseEther('0.01'), parseEther('0.02')])
    expect(v.total).toBe(parseEther('0.03'))
  })

  it('flags duplicates case-insensitively, including non-adjacent ones', () => {
    const v = validateForm({
      mode: 'custom',
      equalTotal: '',
      rows: [row(A, '1'), row(B, '1'), row(C, '1'), row(A.toLowerCase(), '1')],
    })
    expect(v.isValid).toBe(false)
    expect(v.rows[3].addressError).toBe('Duplicate of recipient #1')
    expect(v.rows[0].addressError).toBeUndefined()
    expect(v.recipients).toEqual([])
    expect(v.total).toBe(0n)
  })

  it('reports per-row amount errors', () => {
    const v = validateForm({ mode: 'custom', equalTotal: '', rows: [row(A, '0'), row(B, 'x')] })
    expect(v.isValid).toBe(false)
    expect(v.rows[0].amountError).toMatch(/greater than 0/)
    expect(v.rows[1].amountError).toBeDefined()
  })

  it('equal mode: computes exact shares from the total', () => {
    const v = validateForm({ mode: 'equal', equalTotal: '0.1', rows: [A, B, C, SENDER, CONTRACT, '0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002'].map((a) => row(a)) })
    expect(v.isValid).toBe(true)
    expect(v.total).toBe(parseEther('0.1'))
    expect(v.amounts[0] - v.amounts[6]).toBe(1n)
  })

  it('equal mode: total too small or invalid', () => {
    expect(validateForm({ mode: 'equal', equalTotal: '0.000000000000000002', rows: [row(A), row(B), row(C)] }).totalError).toMatch(/too small/)
    expect(validateForm({ mode: 'equal', equalTotal: '', rows: [row(A)] }).totalError).toMatch(/Enter an amount/)
  })

  it('requires 1..20 recipients', () => {
    expect(validateForm({ mode: 'custom', equalTotal: '', rows: [] }).formErrors).toContain('Add at least one recipient')
    const many = Array.from({ length: 21 }, (_, i) => row('0x' + (i + 1).toString(16).padStart(40, '0'), '1'))
    const v = validateForm({ mode: 'custom', equalTotal: '', rows: many })
    expect(v.isValid).toBe(false)
    expect(v.formErrors[0]).toMatch(/At most 20/)
  })

  it('uses context to block the sender and contract', () => {
    const v = validateForm({ mode: 'custom', equalTotal: '', rows: [row(SENDER, '1'), row(CONTRACT, '1')] }, { senderAddress: SENDER, contractAddress: CONTRACT })
    expect(v.rows[0].addressError).toMatch(/your own/)
    expect(v.rows[1].addressError).toMatch(/contract/)
  })
})
