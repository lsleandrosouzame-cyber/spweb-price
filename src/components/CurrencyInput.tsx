import type { InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: string
  onChange: (value: string) => void
}

export function CurrencyInput({ value, onChange, ...props }: Props) {
  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) { onChange(''); return }
    const cents = Number(digits)
    if (!Number.isSafeInteger(cents)) return
    onChange((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  }
  return <input {...props} type="text" inputMode="decimal" value={value} onChange={event => handleChange(event.target.value)} />
}
