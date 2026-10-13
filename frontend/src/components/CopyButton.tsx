import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function CopyButton({ text, label = 'Copy address' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-ink"
    >
      {copied ? <Check aria-hidden className="h-3.5 w-3.5 text-accent" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
    </button>
  )
}
