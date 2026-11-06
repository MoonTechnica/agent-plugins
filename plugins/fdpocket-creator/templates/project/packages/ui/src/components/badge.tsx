import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import type * as React from 'react'

/** 状態・件数・種類を示す小さなラベル。意味のある場面にだけ色を使う（success / warning / destructive）。 */
const badgeVariants = cva(
  'inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-muted-foreground',
        success: 'bg-success/12 text-success',
        warning: 'bg-warning/20 text-warning-foreground',
        info: 'bg-info/12 text-info',
        destructive: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
