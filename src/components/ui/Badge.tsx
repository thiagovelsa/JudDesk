import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  size?: 'sm' | 'md'
}

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full'

  const variants = {
    default: 'bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] border border-[var(--color-primary)]/20',
    success: 'bg-[var(--color-success)]/10 text-emerald-400 border border-[var(--color-success)]/20',
    warning: 'bg-[var(--color-warning)]/10 text-amber-400 border border-[var(--color-warning)]/20',
    danger: 'bg-[var(--color-urgent)]/10 text-red-400 border border-[var(--color-urgent)]/20',
    info: 'bg-[var(--color-info)]/10 text-blue-400 border border-[var(--color-info)]/20',
    neutral: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </span>
  )
}
