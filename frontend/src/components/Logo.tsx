/** Brand mark: one payment (left) splitting into three recipients (right). */
export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path d="M9 16 C15 16 16 8 23 8 M9 16 H23 M9 16 C15 16 16 24 23 24" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="8" cy="16" r="3.4" fill="var(--color-accent)" />
      <circle cx="24" cy="8" r="2.4" fill="var(--color-ink)" />
      <circle cx="24" cy="16" r="2.4" fill="var(--color-ink)" />
      <circle cx="24" cy="24" r="2.4" fill="var(--color-ink)" />
    </svg>
  )
}
