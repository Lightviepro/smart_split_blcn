import { useCallback, useEffect, useState } from 'react'

interface Settled<T> {
  key: string
  value?: T
  error?: unknown
}

/**
 * Load async data (balances, contract reads, event logs) for a given `key`.
 *
 * Results are stored together with the key they were loaded for, so when the key changes
 * (new account, new network) an old result is never shown as current. While reloading the
 * SAME key (e.g. after a payment), the previous value stays visible to avoid flicker.
 *
 * Pass key = null to disable loading. `load` should be memoised with useCallback.
 */
export function useAsyncData<T>(key: string | null, load: () => Promise<T>) {
  const [version, setVersion] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const fullKey = key === null ? null : `${key}#${version}`

  useEffect(() => {
    if (fullKey === null) return
    let cancelled = false
    load().then(
      (value) => !cancelled && setSettled({ key: fullKey, value }),
      (error: unknown) => !cancelled && setSettled({ key: fullKey, error }),
    )
    return () => {
      cancelled = true
    }
  }, [fullKey, load])

  const current = settled !== null && settled.key === fullKey ? settled : null
  const previous = settled !== null && key !== null && settled.key.startsWith(`${key}#`) ? settled : null

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return {
    value: (current ?? previous)?.value,
    error: current?.error,
    loading: fullKey !== null && current === null,
    reload,
  }
}
