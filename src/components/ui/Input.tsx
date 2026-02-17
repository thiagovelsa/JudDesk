import { forwardRef } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-[var(--color-bg-secondary)] border rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-all duration-200 focus-ring motion-hover',
              'hover:border-[var(--color-border-strong)]',
              leftIcon ? 'pl-10' : 'pl-3',
              rightIcon || error ? 'pr-10' : 'pr-3',
              error
                ? 'border-[var(--color-urgent)] focus:border-[var(--color-urgent)]'
                : 'border-[var(--color-border-default)] focus:border-[var(--color-primary-light)]',
              disabled && 'opacity-50 cursor-not-allowed',
              'h-10 text-sm'
            )}
            disabled={disabled}
            {...props}
          />
          {rightIcon && !error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              {rightIcon}
            </div>
          )}
          {error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-urgent)]">
              <AlertCircle className="size-4" />
            </div>
          )}
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

Input.displayName = 'Input'

export { Input }
