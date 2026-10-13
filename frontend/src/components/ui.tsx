import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

export function Panel({
  title,
  step,
  subtitle,
  actions,
  children,
  className = '',
  labelledBy,
}: {
  title?: ReactNode
  step?: number
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  labelledBy?: string
}) {
  return (
    <section aria-labelledby={labelledBy} className={`float rounded-[26px] p-5 sm:p-7 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {step !== undefined && (
              <span aria-hidden className="well-sm mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs font-medium text-accent">
                {step}
              </span>
            )}
            <div>
              {title && (
                <h2 id={labelledBy} className="text-[17px] font-bold tracking-tight text-ink">
                  {title}
                </h2>
              )}
              {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

const CHIP_TONES = {
  neutral: 'text-muted',
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  warn: 'text-warn',
} as const

const DOT_TONES = {
  neutral: 'bg-faint',
  accent: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
  warn: 'bg-warn',
} as const

export function Chip({ tone = 'neutral', children, dot = true }: { tone?: keyof typeof CHIP_TONES; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`well-sm inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP_TONES[tone]}`}>
      {dot && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT_TONES[tone]}`} />}
      {children}
    </span>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="focus-ring inline-flex items-center gap-0.5 rounded font-semibold text-accent underline decoration-accent/30 underline-offset-[3px] transition-colors hover:decoration-accent"
    >
      {children}
      <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="well inline-flex rounded-full p-1 text-sm">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`focus-ring rounded-full px-3.5 py-1.5 font-semibold transition-all duration-200 disabled:cursor-not-allowed ${
              active ? 'float-sm text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export const buttonPrimary =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_22px_-8px_rgb(106_69_217/0.6)] transition-all duration-150 hover:bg-accent-strong hover:shadow-[0_12px_26px_-8px_rgb(106_69_217/0.7)] active:translate-y-px disabled:cursor-not-allowed disabled:bg-surface-deep disabled:text-faint disabled:shadow-none'

export const buttonSoft =
  'focus-ring float-sm inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink transition-all duration-150 hover:text-accent active:translate-y-px disabled:cursor-not-allowed disabled:text-faint disabled:shadow-none'

export const iconButton =
  'focus-ring float-sm grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-all duration-150 hover:text-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

export const inputBase =
  'well block w-full rounded-2xl border-0 px-4 py-2.5 text-sm text-ink outline-none transition-shadow placeholder:text-faint focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:text-faint'

export const eyebrow = 'text-[11px] font-bold uppercase tracking-[0.12em] text-muted'
