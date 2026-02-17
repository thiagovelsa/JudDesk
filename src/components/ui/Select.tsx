import { forwardRef } from 'react'
import { ChevronDown, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string
  error?: string
  helperText?: string
  options: SelectOption[]
  placeholder?: string
  onChange?: (value: string) => void
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      options,
      placeholder,
      disabled,
      onChange,
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value)
    }

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full h-10 appearance-none bg-[var(--color-bg-secondary)] border rounded-lg text-[var(--color-text-primary)] text-sm transition-all duration-200 focus-ring cursor-pointer',
              'hover:border-[var(--color-border-strong)]',
              'pl-3 pr-10',
              error
                ? 'border-[var(--color-urgent)] focus:border-[var(--color-urgent)]'
                : 'border-[var(--color-border-default)] focus:border-[var(--color-primary-light)]',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            disabled={disabled}
            onChange={handleChange}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">
            {error ? (
              <AlertCircle className="size-4 text-[var(--color-urgent)]" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </div>
        </div>
        {(error || helperText) && (
          <p
            className={cn(
              'mt-1.5 text-xs',
              error ? 'text-[var(--color-urgent)]' : 'text-[var(--color-text-muted)]'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export { Select }
