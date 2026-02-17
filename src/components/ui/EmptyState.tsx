import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="w-16 h-16 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] flex items-center justify-center mb-4">
        <div className="text-[var(--color-text-muted)]">{icon}</div>
      </div>

      <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-4">
          {description}
        </p>
      )}

      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
