import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'glass'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', hoverable = false, children, ...props }, ref) => {
    const baseStyles = 'rounded-lg border transition-all duration-200 motion-hover'

    const variants = {
      default: 'bg-[var(--color-bg-secondary)] border-[var(--color-border-default)]',
      elevated: 'bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] shadow-[var(--shadow-md)]',
      outlined: 'border-[var(--color-border-strong)] bg-transparent',
      // Keep variant for compatibility, but avoid glassmorphism in dense productivity UI.
      glass: 'bg-[var(--color-bg-secondary)] border-[var(--color-border-default)]',
    }

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-4',
      lg: 'p-5',
    }

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          paddings[padding],
          hoverable && 'card-hover cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export { Card }
